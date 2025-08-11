// netlify/functions/agent.ts

import {
  createAgent,
  IDIDManager,
  IKeyManager,
  IResolver,
  ICredentialIssuer,
} from '@veramo/core'

import { CredentialPlugin } from '@veramo/credential-w3c'
import { DIDManager } from '@veramo/did-manager'
import { KeyManager } from '@veramo/key-manager'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'
import { KeyDIDProvider } from '@veramo/did-provider-key'
import { Resolver } from 'did-resolver'
import { getDidKeyResolver } from '@veramo/did-provider-key'
import { CredentialIssuerLD, VeramoEd25519Signature2018, ICredentialIssuerLD } from '@veramo/credential-ld'
import { contexts } from '@digitalbazaar/credentials-context'

import {
  Entities,
  KeyStore,
  DIDStore,
  PrivateKeyStore,
  migrations,
  DataStore,
  DataStoreORM,
} from '@veramo/data-store'

import { DataSource } from 'typeorm'
import * as os from 'os'
import * as path from 'path'

const KMS_SECRET_KEY = '4a92dd58289d4f65b9c412346c351f4e'

// ── Use a writable location for SQLite in serverless (Netlify/Lambda): /tmp
//    Falls back to local file when running outside serverless (dev).
const serverlessDbPath = path.join(os.tmpdir(), 'veramo.sqlite')
const localDbPath = path.join(process.cwd(), 'veramo.sqlite')
const dbFile = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME ? serverlessDbPath : localDbPath

const dbConnection = new DataSource({
  type: 'sqljs',       // pure JS / WASM driver
  entities: Entities,
  synchronize: true,   // auto-create tables, no migrations needed
  migrationsRun: false,
  logging: false,
})

let agentInstance: any
let initialized = false

export const getAgent = async () => {
  if (!initialized) {
    await dbConnection.initialize()
    await dbConnection.runMigrations()   // ensure tables (incl. PreMigrationKey) are created
    initialized = true

    agentInstance = createAgent<IDIDManager & IKeyManager & ICredentialIssuer & ICredentialIssuerLD & IResolver>({
      plugins: [
        new KeyManager({
          store: new KeyStore(dbConnection),
          kms: {
            local: new KeyManagementSystem(
              new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))
            ),
          },
        }),
        new DIDManager({
          store: new DIDStore(dbConnection),
          defaultProvider: 'did:key',
          providers: {
            'did:key': new KeyDIDProvider({ defaultKms: 'local' }),
          },
        }),
        new CredentialPlugin(),
        new CredentialIssuerLD({
          suites: [new VeramoEd25519Signature2018()],
          contextMaps: [contexts],
        }),
        new DIDResolverPlugin({
          resolver: new Resolver({
            ...getDidKeyResolver(),
          }),
        }),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),
      ],
    })

    console.log(`✅ Agent initialized. SQLite @ ${dbFile}`)
  }

  return agentInstance
}

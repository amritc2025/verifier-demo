// netlify/functions/agent.ts

import 'reflect-metadata'

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
import { KeyDIDProvider, getDidKeyResolver } from '@veramo/did-provider-key'
import { Resolver } from 'did-resolver'
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

const KMS_SECRET_KEY = '4a92dd58289d4f65b9c412346c351f4e'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

/** Postgres connection (DATABASE_URL must be set in Netlify env) */
const dbConnection = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed on Neon/Supabase; safe for demos
  entities: Entities,
  migrations,
  migrationsRun: true,   // ensure tables exist on cold start
  synchronize: false,    // rely on migrations, not auto-sync
  logging: false,
})

let agentInstance: any
let initialized = false

export const getAgent = async () => {
  if (!initialized) {
    console.log('Connecting to Postgres')
    await dbConnection.initialize()
    // (migrationsRun: true already auto-runs, but calling explicitly is harmless)
    // await dbConnection.runMigrations()
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
          resolver: new Resolver({ ...getDidKeyResolver() }),
        }),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),
      ],
    })

    console.log('✅ Agent initialized with Postgres')
  }

  return agentInstance
}

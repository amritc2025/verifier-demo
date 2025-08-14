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

// parse DATABASE_URL so we can force SSL properly
const u = new URL(process.env.DATABASE_URL)
const host = u.hostname
const port = Number(u.port || '6543')
const database = u.pathname.replace(/^\//, '') || 'postgres'
const username = decodeURIComponent(u.username)
const password = decodeURIComponent(u.password)

const dbConnection = new DataSource({
  type: 'postgres',
  host,
  port,
  database,
  username,
  password,
  // proper SSL for Supabase pooler in serverless
  ssl: { rejectUnauthorized: false },
  entities: Entities,
  migrations,
  migrationsRun: false,
  synchronize: false,
  logging: false,
})

let initialized = false
let baseAgent: any

// Base agent: DID, keys, resolver, data-store, credential-w3c (no credential-ld here)
export const getAgent = async () => {
  if (!initialized) {
    await dbConnection.initialize()

    baseAgent = createAgent<IDIDManager & IKeyManager & ICredentialIssuer & IResolver>({
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
          providers: { 'did:key': new KeyDIDProvider({ defaultKms: 'local' }) },
        }),
        new DIDResolverPlugin({
          resolver: new Resolver({ ...getDidKeyResolver() }),
        }),
        new DataStore(dbConnection),
        new DataStoreORM(dbConnection),

        // keep the classic W3C plugin (lightweight); LD will be added lazily in the issuer
        new CredentialPlugin(),
      ],
    })

    initialized = true
    console.log('✅ Base agent initialized (no credential-ld)')
  }

  return baseAgent
}

// helper exported for issuer to reuse the same connection details
export const getDbConnection = () => dbConnection

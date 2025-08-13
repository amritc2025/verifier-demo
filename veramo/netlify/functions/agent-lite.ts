// netlify/functions/agent-lite.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { createAgent } from '@veramo/core'
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager'
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { Resolver } from 'did-resolver'
import { KeyDIDProvider } from '@veramo/did-provider-key'
import { getResolver as keyDidResolver } from 'key-did-resolver'
import { getResolver as webDidResolver } from 'web-did-resolver'

const SECRET_KEY = (process.env.KMS_SECRET_KEY || 'insecure-dev-secret').padEnd(32, '0').slice(0, 32)

export const handler: Handler = async (event) => {
  try {
    // Toggle DB plugin with ?useDb=1 (default: no DB to isolate plugin/bundling issues)
    const useDb = event?.queryStringParameters?.useDb === '1'

    // --- minimal agent (no credential-ld / JSON-LD suites) ---
    const basePlugins: any[] = [
      new KeyManager({
        store: new MemoryKeyStore(),
        kms: {
          local: new KeyManagementSystem(new MemoryPrivateKeyStore(), new SecretBox(SECRET_KEY)),
        },
      }),
      new DIDManager({
        store: new MemoryDIDStore(),                 // no DB by default
        defaultProvider: 'did:key',
        providers: {
          'did:key': new KeyDIDProvider({ defaultKms: 'local' }),
        },
      }),
      new DIDResolverPlugin({
        resolver: new Resolver({
          ...keyDidResolver(),
          ...webDidResolver(),                       // harmless; helps test resolution layer
        }),
      }),
    ]

    // Optionally add @veramo/data-store to also exercise Postgres (after your migrations work)
    if (useDb) {
      const { DataSource } = await import('typeorm')
      const ds = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        ssl: true,
        extra: { ssl: { rejectUnauthorized: false } },
        schema: 'public',
        logging: false,
        // keep data-store out until we import its Entities/migrations:
      } as any)
      await ds.initialize()

      const { Entities, DataStore, DataStoreORM, migrations } = await import('@veramo/data-store')
      // Run migrations once here too (no-op if already done)
      await ds.runMigrations?.().catch(async () => {
        // If no migrations are attached to the DS, attach and run explicitly:
        ;(ds as any).options.migrations = migrations
        await ds.runMigrations()
      })

      basePlugins.push(new DataStore(ds, { entities: Entities }))
      basePlugins.push(new DataStoreORM(ds, { entities: Entities }))
    }

    const agent = createAgent({
      plugins: basePlugins,
    })

    // Lightweight smoke tests that do NOT need credential-ld
    const providers = await agent.didManagerGetProviders()
    const key = await agent.keyManagerCreate({ type: 'Ed25519' })
    const did = await agent.didManagerCreate({ provider: 'did:key', kms: 'local' })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: true,
        useDb,
        providers,
        keyType: key.type,
        did: did.did,
        note: 'No @veramo/credential-ld loaded in this endpoint',
      }),
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, message: e?.message || String(e) }),
    }
  }
}

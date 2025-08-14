// netlify/functions/migrate.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

const json = (code: number, body: any) => ({
  statusCode: code,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  let ds: DataSource | undefined

  try {
    const dry = event?.queryStringParameters?.dry === '1'

    const rawUrl = process.env.DATABASE_URL_MIGRATOR || process.env.DATABASE_URL
    if (!rawUrl) return json(500, { ok: false, message: 'No DATABASE_URL_MIGRATOR or DATABASE_URL set' })

    // Parse URL ourselves to avoid pg-connection-string edge cases
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return json(500, {
        ok: false,
        message: 'Invalid Postgres URL in DATABASE_URL_MIGRATOR/DATABASE_URL',
        sample: rawUrl.slice(0, 80) + (rawUrl.length > 80 ? '…' : ''),
      })
    }

    const isPooler = /\.pooler\./.test(parsed.hostname)

    ds = new DataSource({
      type: 'postgres',
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      ssl: true,
      extra: { ssl: { rejectUnauthorized: false } },
      schema: 'public',
      entities: Entities,
      migrations,              // available for upgrades later
      migrationsRun: false,    // we invoke runMigrations() manually below
      synchronize: false,      // we’ll call synchronize() on demand
      logging: false,
    } as any)

    await ds.initialize()

    const [{ current_database }] = await ds.query('SELECT current_database() AS current_database')
    const [{ current_schema }]  = await ds.query('SELECT current_schema() AS current_schema')

    let ran: any[] = []
    let createdVia: 'migrations' | 'synchronize' | undefined

    if (!dry) {
      try {
        // Try migrations first (in case you’re upgrading an existing DB)
        ran = await ds.runMigrations()
        createdVia = 'migrations'
      } catch (e: any) {
        const msg = (e?.message || '').toLowerCase()
        const looksLikeFreshDb =
          msg.includes('premigrationkey') ||
          msg.includes('does not exist') ||
          msg.includes('relation') && msg.includes('not exist')

        if (!looksLikeFreshDb) throw e

        // Fresh DB path: create the latest schema directly from Entities
        await ds.synchronize()
        createdVia = 'synchronize'
        ran = []
      }
    }

    return json(200, {
      ok: true,
      current_database,
      current_schema,
      createdVia: dry ? 'none' : createdVia,
      ran,
      dry,
      note: isPooler
        ? 'Warning: using Supabase Session Pooler for migrations (IPv4). Prefer direct host when available.'
        : undefined,
    })
  } catch (e: any) {
    return json(500, { ok: false, message: e?.message || String(e), stack: e?.stack })
  } finally {
    try { if (ds?.isInitialized) await ds.destroy() } catch {}
  }
}

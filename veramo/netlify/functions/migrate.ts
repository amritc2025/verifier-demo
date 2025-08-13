// netlify/functions/migrate.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
})

export const handler: Handler = async (event) => {
  // We'll close the DataSource in a finally block if it gets created.
  let ds: DataSource | undefined

  try {
    // Optional: allow dry run with ?dry=1
    const dry = event?.queryStringParameters?.dry === '1'

    // Prefer a direct (non-pooler) URL for DDL; fall back to normal URL
    const rawUrl = process.env.DATABASE_URL_MIGRATOR || process.env.DATABASE_URL
    if (!rawUrl) {
      return json(500, {
        ok: false,
        message: 'No DATABASE_URL_MIGRATOR or DATABASE_URL set',
      })
    }

    // Validate & parse the URL ourselves to avoid pg-connection-string edge cases
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return json(500, {
        ok: false,
        message:
          'Invalid Postgres URL in DATABASE_URL_MIGRATOR/DATABASE_URL. Paste the REAL direct Supabase URL (db.<project-ref>.<region>.supabase.co) — not placeholders.',
        sample: rawUrl.slice(0, 80) + (rawUrl.length > 80 ? '…' : ''),
      })
    }

    const isPooler =
      /\.pooler\./.test(parsed.hostname) ||
      parsed.hostname.includes('pooler.supabase.com')

    // Build a DS config with discrete fields (host/port/user/pass/db)
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
      migrations,
      migrationsRun: false,
      synchronize: false,
      logging: false,
    } as any)

    await ds.initialize()

    const [{ current_database }] = await ds.query(
      'SELECT current_database() AS current_database',
    )
    const [{ current_schema }] = await ds.query(
      'SELECT current_schema() AS current_schema',
    )

    const ran = dry ? [] : await ds.runMigrations()

    return json(200, {
      ok: true,
      current_database,
      current_schema,
      ran,
      dry,
      note: isPooler
        ? 'Warning: using Supabase pooler host for migrations. Prefer the direct host (db.<project-ref>.<region>.supabase.co).'
        : undefined,
    })
  } catch (e: any) {
    return json(500, {
      ok: false,
      message: e?.message || String(e),
      stack: e?.stack,
    })
  } finally {
    try {
      if (ds?.isInitialized) await ds.destroy()
    } catch {
      // ignore
    }
  }
}

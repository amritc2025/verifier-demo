// netlify/functions/db-check.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

export const handler: Handler = async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: true,
    extra: { ssl: { rejectUnauthorized: false } },
    entities: Entities,
    migrations,
    migrationsRun: true,    // <-- ensure migrations run
    synchronize: false,
    logging: false,
  })

  try {
    await ds.initialize()
    // Explicitly run migrations (harmless if already applied)
    await ds.runMigrations()
    await ds.query('SELECT 1')
    await ds.destroy()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, migrated: true })
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, message: e?.message || String(e) })
    }
  }
}

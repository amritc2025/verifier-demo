// netlify/functions/migrate.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

export const handler: Handler = async () => {
  // Use a direct (non-pooler) URL if provided, else fall back to DATABASE_URL
  const url = process.env.DATABASE_URL_MIGRATOR || process.env.DATABASE_URL
  if (!url) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, message:'No DATABASE_URL provided' }) }
  }

  const ds = new DataSource({
    type: 'postgres',
    url,
    // Supabase + serverless: keep SSL on and don’t verify CA
    ssl: true,
    extra: { ssl: { rejectUnauthorized: false } },
    entities: Entities,
    migrations,
    migrationsRun: false,
    synchronize: false,
    logging: false,
    // Ensure we land in the expected schema
    schema: 'public',
  })

  try {
    await ds.initialize()

    // Make sure we're on the right DB & schema (useful for debugging)
    const [{ current_database }] = await ds.query(`SELECT current_database() AS current_database`)
    const [{ current_schema }]  = await ds.query(`SELECT current_schema()   AS current_schema`)
    // Run migrations (no-op if already applied)
    const ran = await ds.runMigrations()

    await ds.destroy()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok:true, current_database, current_schema, ran })
    }
  } catch (e:any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok:false, message: e?.message || String(e) })
    }
  }
}

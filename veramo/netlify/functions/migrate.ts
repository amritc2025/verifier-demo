// netlify/functions/migrate.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

export const handler: Handler = async (event) => {
  try {
    // Optional: allow dry run with ?dry=1
    const dry = event?.queryStringParameters?.dry === '1'

    // Prefer a direct (non-pooler) URL for DDL; fall back to normal URL
    const url = process.env.DATABASE_URL_MIGRATOR || process.env.DATABASE_URL
    if (!url) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, message: 'No DATABASE_URL/DATABASE_URL_MIGRATOR set' }),
      }
    }

    const ds = new DataSource({
      type: 'postgres',
      url,
      ssl: true,
      extra: { ssl: { rejectUnauthorized: false } },
      schema: 'public',
      entities: Entities,
      migrations,
      migrationsRun: false,
      synchronize: false,
      logging: false,
    })

    await ds.initialize()

    const [{ current_database }] = await ds.query('SELECT current_database() AS current_database')
    const [{ current_schema }] = await ds.query('SELECT current_schema() AS current_schema')

    const ran = dry ? [] : await ds.runMigrations()

    await ds.destroy()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, current_database, current_schema, ran, dry }),
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, message: e?.message || String(e),stack: e?.stack  }),
    }
  }
}

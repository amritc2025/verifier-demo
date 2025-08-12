//netlify/functions/db-check.ts

import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Entities, migrations } from '@veramo/data-store'

export const handler: Handler = async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: true, // important when using URL
  extra: { ssl: { rejectUnauthorized: false } }, // <- pg respects this
    entities: Entities,
    migrations,
    migrationsRun: false,
    synchronize: false,
    logging: false,
  })

  try {
    await ds.initialize()
    await ds.query('SELECT 1')
    await ds.destroy()
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true }) }
  } catch (e: any) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: e?.message || String(e) }) }
  }
}

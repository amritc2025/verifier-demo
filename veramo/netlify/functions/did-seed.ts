// netlify/functions/did-seed.ts
import type { Handler } from '@netlify/functions'
import 'reflect-metadata'
import { getAgent } from './agent' // your existing agent factory

export const handler: Handler = async () => {
  try {
    const agent = await getAgent()
    const alias = process.env.ISSUER_ALIAS || 'issuer-prod'
    const provider = 'did:key'

    // Try to reuse an existing DID with this alias (idempotent)
    let didObj
    try {
      didObj = await agent.didManagerGetByAlias({ alias, provider })
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, did: didObj.did, alias, existed: true }),
      }
    } catch {
      // Not found → create once
      didObj = await agent.didManagerCreate({ provider, kms: 'local', alias })
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, did: didObj.did, alias, existed: false }),
      }
    }
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, message: e?.message || String(e) }),
    }
  }
}

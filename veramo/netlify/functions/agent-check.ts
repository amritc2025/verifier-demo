//netlify/functions/agent-check.ts

import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  try {
    const { getAgent } = await import('./agent')
    const agent = await getAgent()
    // minimal usage to ensure plugins are live
    const ids = await agent.didManagerFind()
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, dids: ids.map((i:any)=>i.did) }) }
  } catch (e: any) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, message: e?.message || String(e) }) }
  }
}

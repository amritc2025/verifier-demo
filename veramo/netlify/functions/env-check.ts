//netlify/functions/env-check.ts

import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const url = process.env.DATABASE_URL || ''
  // don’t echo secrets; just show if set and the host
  let host = ''
  try {
    if (url) host = new URL(url).hostname
  } catch {}
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ hasDatabaseUrl: Boolean(url), host }),
  }
}

//netlify/functions/token.ts

import { Handler } from '@netlify/functions'

/**
 * Minimal OID4VCI token endpoint for the pre-authorized_code flow.
 * Accepts:
 *  - application/x-www-form-urlencoded
 *  - application/json
 */
export const handler: Handler = async (event) => {
  // Only POST per spec
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'POST',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: 'Method Not Allowed',
    }
  }

  // Parse body (either form-encoded or JSON)
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || ''
  let params: Record<string, string> = {}

  if (contentType.includes('application/x-www-form-urlencoded')) {
    params = Object.fromEntries(new URLSearchParams(event.body || ''))
  } else {
    try {
      params = JSON.parse(event.body || '{}')
    } catch {
      // ignore
    }
  }

  const grantType = params.grant_type
  const preAuthCode = params['pre-authorized_code'] || params.pre_authorized_code

  if (grantType !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ error: 'unsupported_grant_type' }),
    }
  }

  if (preAuthCode !== 'test-code-123') {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ error: 'invalid_grant' }),
    }
  }

  // Issue an access token (demo)
  const accessToken = 'access-test-code-123'
  const cNonce = 'nonce-' + Math.random().toString(36).slice(2)

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 600,
      c_nonce: cNonce,
      c_nonce_expires_in: 600,
    }),
  }
}

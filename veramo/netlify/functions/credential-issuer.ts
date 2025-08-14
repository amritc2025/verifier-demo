// netlify/functions/credential-issuer.ts
import type { Handler } from '@netlify/functions'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }
const METHOD_HEADERS = (allow: string) => ({ ...CORS_HEADERS, 'Content-Type': 'application/json', 'Allow': allow })

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: METHOD_HEADERS('POST'), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: METHOD_HEADERS('POST'), body: JSON.stringify({ error: 'method_not_allowed' }) }
  }

  // Simple bearer check (pre-auth flow demo)
  const rawAuth = (event.headers['authorization'] || event.headers['Authorization'] || '').toString()
  if (!rawAuth.toLowerCase().startsWith('bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }) }
  }
  const token = rawAuth.slice('bearer '.length).trim()
  if (token !== 'access-test-code-123') {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) }
  }

  try {
    // 1) base agent (no LD wired globally)
    const { getAgent } = await import('./agent')
    const agent: any = await getAgent()

    // 2) resolve issuer DID by alias (seed once via /did-seed)
    const alias = process.env.ISSUER_ALIAS || 'issuer-prod'
    let issuerIdentifier: any
    try {
      issuerIdentifier = await agent.didManagerGetByAlias({ alias, provider: 'did:key' })
    } catch {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          error: 'server_error',
          message: `Issuer DID with alias "${alias}" not found. Run /.netlify/functions/did-seed once, then retry.`,
        }),
      }
    }
    const issuerDid: string = issuerIdentifier.did

    // 3) parse request (caller may override subject/claims)
    let body: any = {}
    try { body = event.body ? JSON.parse(event.body) : {} } catch {}
    const subjectDid = body?.credentialSubject?.id || body?.subject || issuerDid // demo default
    const credentialSubject = body?.credentialSubject || {
      id: subjectDid,
      givenName: 'John',
      familyName: 'Walt',
      birthDate: '2000-01-01',
      drivingClass: 'Motocycle, Private Car',
      expiryDate: '2030-12-31',
    }

    // 4) build unsigned VC (JSON / Data Integrity)
    const unsignedVc = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        {
          MobileDrivingLicence: 'https://example.org/mdl#MobileDrivingLicence',
          givenName: 'https://schema.org/givenName',
          familyName: 'https://schema.org/familyName',
          birthDate: 'https://schema.org/birthDate',
          drivingClass: 'https://example.org/mdl#drivingClass',
          expiryDate: 'https://schema.org/validThrough',
        },
      ],
      type: ['VerifiableCredential', 'MobileDrivingLicence'],
      issuer: { id: issuerDid },
      issuanceDate: new Date().toISOString(),
      credentialSubject,
    }

    // 5) lazy-load LD issuer and issue as LDP VC (format expected by MATTR for JSON creds)
    const { CredentialIssuerLD, VeramoEd25519Signature2018 } = await import('@veramo/credential-ld')
    const { contexts } = await import('@digitalbazaar/credentials-context')

    const agentWithLd: any = Object.assign({}, agent, {
      plugins: [
        ...(agent.plugins || []),
        new CredentialIssuerLD({
          suites: [new VeramoEd25519Signature2018()],
          contextMaps: [contexts],
        }),
      ],
    })

    const vc = await agentWithLd.createVerifiableCredential({
      credential: unsignedVc,
      proofFormat: 'ldp_vc', // JSON (Data Integrity) format for OID4VCI
    })

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
  } catch (e: any) {
    console.error('issuer error', e)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', message: e?.message || String(e) }) }
  }
}

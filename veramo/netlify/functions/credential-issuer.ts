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
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: METHOD_HEADERS('POST'), body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: METHOD_HEADERS('POST'), body: JSON.stringify({ error: 'method_not_allowed' }) }

  // Simple bearer check
  const rawAuth = String(event.headers['authorization'] || event.headers['Authorization'] || '')
  if (!rawAuth.toLowerCase().startsWith('bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }) }
  }
  const token = rawAuth.slice('bearer '.length).trim()
  if (token !== 'access-test-code-123') return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) }

  try {
    // 1) base agent
    const { getAgent } = await import('./agent')
    const agent: any = await getAgent()

    // 2) issuer DID by alias (seed once via /did-seed)
    const alias = process.env.ISSUER_ALIAS || 'issuer-prod'
    let issuerIdentifier: any
    try {
      issuerIdentifier = await agent.didManagerGetByAlias({ alias, provider: 'did:key' })
    } catch {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'server_error', message: `Issuer DID with alias "${alias}" not found. Run /.netlify/functions/did-seed once, then retry.` }),
      }
    }
    const issuerDid: string = issuerIdentifier.did

    // 3) request parsing
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

    // 4) unsigned VC
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

    // 5) LD issuance using ONLY Veramo's built-in contexts
    try {
      const { CredentialIssuerLD, VeramoEd25519Signature2018, LdDefaultContexts } = await import('@veramo/credential-ld')

      const agentWithLd: any = Object.assign({}, agent, {
        plugins: [
          ...(agent.plugins || []),
          new CredentialIssuerLD({
            suites: [new VeramoEd25519Signature2018()],
            contextMaps: [LdDefaultContexts], // <— minimal & safe
          }),
        ],
      })

      const vc = await agentWithLd.createVerifiableCredential({
        credential: unsignedVc,
        // Veramo canonical name for Data Integrity. (OID4VCI "format" is ldp_vc.)
        proofFormat: 'lds',
      })

      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
    } catch (ldErr: any) {
      // Return a clear error instead of opaque 502
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'ldp_error', message: ldErr?.message || String(ldErr) }) }
    }
  } catch (e: any) {
    console.error('issuer error', e)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', message: e?.message || String(e) }) }
  }
}

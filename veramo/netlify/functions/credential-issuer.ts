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

  // Simple bearer check (pre-auth demo)
  const rawAuth = String(event.headers['authorization'] || event.headers['Authorization'] || '')
  if (!rawAuth.toLowerCase().startsWith('bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }) }
  }
  const token = rawAuth.slice('bearer '.length).trim()
  if (token !== 'access-test-code-123') return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) }

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
        body: JSON.stringify({ error: 'server_error', message: `Issuer DID with alias "${alias}" not found. Run /.netlify/functions/did-seed once, then retry.` }),
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

    // 5) choose format: default LD (for MATTR JSON creds), optional JWT via env for debugging
    const prefer = (process.env.VC_FORMAT || 'ldp_vc').toLowerCase()

    if (prefer === 'jwt_vc_json') {
      // JWT VC path (debug or if you intentionally want VC-JWT)
      if (typeof (agent as any).createVerifiableCredential !== 'function') {
        const { CredentialIssuer } = await import('@veramo/credential-w3c')
        const agentWithJwt: any = Object.assign({}, agent, { plugins: [ ...(agent.plugins || []), new CredentialIssuer() ] })
        const vc = await agentWithJwt.createVerifiableCredential({ credential: unsignedVc, proofFormat: 'jwt' })
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
      }
      const vc = await agent.createVerifiableCredential({ credential: unsignedVc, proofFormat: 'jwt' })
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
    }

    // LD (Data Integrity) path — expected by MATTR for JSON credentials
    try {
      const { CredentialIssuerLD, VeramoEd25519Signature2018, LdDefaultContexts } = await import('@veramo/credential-ld')
      const { contexts } = await import('@digitalbazaar/credentials-context')

      const agentWithLd: any = Object.assign({}, agent, {
        plugins: [
          ...(agent.plugins || []),
          new CredentialIssuerLD({
            suites: [new VeramoEd25519Signature2018()],
            // include both Veramo’s baked contexts and the W3C VC context map
            contextMaps: [LdDefaultContexts, contexts],
          }),
        ],
      })

      const vc = await agentWithLd.createVerifiableCredential({
        credential: unsignedVc,
        // Veramo accepts 'lds' (Data Integrity). 'ldp_vc' is an alias in newer versions, but 'lds' is safest.
        proofFormat: 'lds',
      })

      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
    } catch (ldErr: any) {
      // Surface the LD loader/suite error clearly (avoid opaque 502s)
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'ldp_error', message: ldErr?.message || String(ldErr) }),
      }
    }
  } catch (e: any) {
    console.error('issuer error', e)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', message: e?.message || String(e) }) }
  }
}

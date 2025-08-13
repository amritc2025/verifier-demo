// netlify/functions/credential-issuer.ts
import type { Handler } from '@netlify/functions'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}
const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
}
const METHOD_HEADERS = (allow: string) => ({
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Allow': allow,
})

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: METHOD_HEADERS('POST'), body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: METHOD_HEADERS('POST'), body: JSON.stringify({ error: 'method_not_allowed' }) }
  }

  const rawAuth = (event.headers['authorization'] || event.headers['Authorization'] || '').toString()
  if (!rawAuth.toLowerCase().startsWith('bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }) }
  }
  const token = rawAuth.slice('bearer '.length)
  if (token !== 'access-test-code-123') {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) }
  }

  try {
    // 1) load base agent (no credential-ld)
    const { getAgent } = await import('./agent')
    const agent = await getAgent()

    // 2) lazily load credential-ld + contexts right before issuance
    const { CredentialIssuerLD, VeramoEd25519Signature2018 } = await import('@veramo/credential-ld')
    const { contexts } = await import('@digitalbazaar/credentials-context')

    // 3) create a temporary agent WITH the LD plugin attached
    //    (re-using the same base agent methods via "context" mechanism)
    const agentWithLd = Object.assign({}, agent, {
      plugins: [
        ...(agent.plugins || []),
        new CredentialIssuerLD({
          suites: [new VeramoEd25519Signature2018()],
          contextMaps: [contexts],
        }),
      ],
    })

    // 4) find or create issuer DID
    const identifiers = await agent.didManagerFind()
    const issuerDid = identifiers.length
      ? identifiers[0].did
      : (await agent.didManagerCreate({ provider: 'did:key' })).did

    const subjectDid = issuerDid

    // 5) issue LDP VC using the LD-capable agent
    const vc = await agentWithLd.createVerifiableCredential({
      credential: {
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
        credentialSubject: {
          id: subjectDid,
          givenName: 'John',
          familyName: 'Walt',
          birthDate: '2000-01-01',
          drivingClass: 'Motocycle, Private Car',
          expiryDate: '2030-12-31',
        },
      },
      proofFormat: 'ldp_vc',
    })

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(vc) }
  } catch (e: any) {
    console.error('issuer error', e)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', message: e?.message || String(e) }) }
  }
}

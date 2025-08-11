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

  const authHeader = (event.headers['authorization'] || event.headers['Authorization'] || '').toString()
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }) }
  }

  const token = authHeader.slice('bearer '.length)
  if (token !== 'access-test-code-123') {
    return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid_token' }) }
  }

  try {
    // ⬇️ Lazy-load the agent so any init errors are caught by this try/catch
    const { getAgent } = await import('./agent')

    console.log('credential-issuer: initializing agent / DB connection…')
    const agent = await getAgent()
    console.log('credential-issuer: agent ready, issuing VC…')

    // Demo: issue to issuer DID (you can parse event.body to honor subject/proof, etc.)
    const identifiers = await agent.didManagerFind()
    const issuerDid = identifiers.length ? identifiers[0].did : (await agent.didManagerCreate({ provider: 'did:key' })).did
    const subjectDid = issuerDid

    const vc = await agent.createVerifiableCredential({
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
  } catch (error: any) {
    console.error('credential-issuer error:', error)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server_error', message: error?.message || String(error) }) }
  }
}

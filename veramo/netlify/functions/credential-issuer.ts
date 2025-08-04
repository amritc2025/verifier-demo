// netlify/functions/credential-issuer.ts
import { Handler } from '@netlify/functions'
import { getAgent } from './agent'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  // Example: Check Authorization header if required
  const authHeader = event.headers['authorization'] || event.headers['Authorization']
  if (!authHeader) {
    return { statusCode: 401, body: 'Unauthorized: Missing Authorization header' }
  }

  // For pre-authorized code, validate it here (demo only)
  if (!authHeader.startsWith('Bearer test-code-123')) {
    return { statusCode: 403, body: 'Forbidden: Invalid pre-authorized code' }
  }

  try {
    const agent = await getAgent()

    const identifiers = await agent.didManagerFind()
    let issuerDid: string
    if (identifiers.length === 0) {
      const identifier = await agent.didManagerCreate({ provider: 'did:key' })
      issuerDid = identifier.did
    } else {
      issuerDid = identifiers[0].did
    }

    const subjectDid = issuerDid

    const credential = await agent.createVerifiableCredential({
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
      proofFormat: 'jwt_vc',
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(credential),
    }
  } catch (error: any) {
    return { statusCode: 500, body: error.message }
  }
}

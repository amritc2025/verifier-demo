// netlify/functions/credential-issuer.ts
import type { Handler } from '@netlify/functions'
import { agent } from './agent'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Allow': 'GET',
        'Content-Type': 'text/plain',
      },
      body: 'Method Not Allowed',
    }
  }

  try {
    // Load existing or create new issuer DID
    const identifiers = await agent.didManagerFind()
    const issuerDid = identifiers.length > 0
      ? identifiers[0].did
      : (await agent.didManagerCreate({ provider: 'did:key' })).did

    // Set subject as same DID (for demo)
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
          drivingClass: 'Motorcycle, Private Car',
          expiryDate: '2030-12-31',
        },
      },
      proofFormat: 'lds',
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Consider tightening this in production
      },
      body: JSON.stringify(credential),
    }
  } catch (error: any) {
    return {
      statusCode: 500,
      body: `Error issuing credential: ${error.message}`,
    }
  }
}

export { handler }

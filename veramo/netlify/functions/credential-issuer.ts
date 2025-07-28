// netlify/functions/credential-issuer.ts
import { Handler } from '@netlify/functions'
import { agent } from '../../agent'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    // Get or create issuer DID
    const identifiers = await agent.didManagerFind()
    let issuerDid: string
    if (identifiers.length === 0) {
      const identifier = await agent.didManagerCreate({ provider: 'did:key' })
      issuerDid = identifier.did
    } else {
      issuerDid = identifiers[0].did
    }

    // For demo, issue credential to same DID as subject
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
      proofFormat: 'lds',
    })

    // Return the signed VC JSON to the client (wallet)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // adjust for production
      },
      body: JSON.stringify(credential),
    }
  } catch (error: any) {
    return { statusCode: 500, body: error.message }
  }
}

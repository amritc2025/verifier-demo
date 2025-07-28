// netlify/functions/credential-issuer.ts
import { Handler } from '@netlify/functions'
import { getAgent } from './agent'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    if (!event.body) {
      return { statusCode: 400, body: 'Missing request body' }
    }

    const credentialData = JSON.parse(event.body)

    const agent = await getAgent()

    const verifiableCredential = await agent.createVerifiableCredential({
      credential: {
        issuer: { id: credentialData.issuer },
        '@context': credentialData['@context'],
        type: credentialData.type,
        issuanceDate: new Date().toISOString(),
        credentialSubject: credentialData.credentialSubject,
      },
      proofFormat: 'jwt',
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(verifiableCredential),
    }
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

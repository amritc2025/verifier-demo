// netlify/functions/verify-vc.ts
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

    const { credential } = JSON.parse(event.body)

    if (!credential) {
      return { statusCode: 400, body: 'Missing credential in request body' }
    }

    const agent = await getAgent()

    const verificationResult = await agent.verifyCredential({
      credential,
      proofPurpose: 'assertionMethod',
    })

    if (verificationResult.verified) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ verified: true, details: verificationResult }),
      }
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ verified: false, error: verificationResult.error }),
      }
    }
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

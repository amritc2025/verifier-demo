// netlify/functions/credential-offer.ts
import { Handler } from '@netlify/functions'

const handler: Handler = async (event, context) => {
  const credentialOffer = {
    credential_issuer: "https://your-public-host.com",
    credentials: ["MobileDrivingLicence"],
    grants: {
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
        "pre-authorized_code": "test-code-123",
        user_pin_required: false
      }
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(credentialOffer)
  }
}

export { handler }

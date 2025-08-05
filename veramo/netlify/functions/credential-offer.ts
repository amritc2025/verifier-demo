// netlify/functions/credential-offer.ts
import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const responsePayload = {
    credential_issuer: 'https://mdl-project.netlify.app/.netlify/functions/metadata',
    credential_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/credential-issuer',
    credentials_supported: [
      {
        id: 'MobileDrivingLicence',
        types: ['VerifiableCredential', 'MobileDrivingLicence'],
        format: 'jwt_vc_json',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['ES256'],
      },
    ],
    grants: {
  'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
    'pre-authorized_code': 'test-code-123',
    user_pin_required: false,
  },
}

  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(responsePayload),
  }
}

// netlify/functions/openid-credential-issuer.ts
import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const meta = {
    credential_issuer: 'https://mdl-project.netlify.app', // origin only
    credential_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/credential-issuer',
    token_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/token',

    // MATTR expects a "credentials" map, not "credentials_supported" array
    credentials: {
      MobileDrivingLicence: {
        format: 'ldp_vc', // must match what you actually issue
        types: ['VerifiableCredential', 'MobileDrivingLicence'],
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['Ed25519Signature2018'],
      },
    },

    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': { input_descriptions: [] },
        user_pin_required: false,
      },
    },
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(meta),
  }
}

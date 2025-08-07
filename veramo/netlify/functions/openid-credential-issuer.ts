// netlify/functions/.well-known/openid-credential-issuer.ts

import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const metadata = {
    issuer: 'https://mdl-project.netlify.app',
    credential_issuer: 'https://mdl-project.netlify.app',
    credential_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/credential-issuer',
    token_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/token',
    credentials_supported: [
      {
        id: 'MobileDrivingLicence',
        types: ['VerifiableCredential', 'MobileDrivingLicence'],
        format: 'ldp_vc',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['Ed25519Signature2018'],
      },
    ],
    grants_supported: ['urn:ietf:params:oauth:grant-type:pre-authorized_code'],
    pre_authorized_code_supported: true,
    user_pin_required: false,
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(metadata),
  }
}


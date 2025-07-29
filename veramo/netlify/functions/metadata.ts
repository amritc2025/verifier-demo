import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const metadata = {
    issuer: 'https://mdl-project.netlify.app',
    authorization_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/authorize',  // if you implement OAuth
    credential_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/credential-issuer',
    credential_issuer: 'https://mdl-project.netlify.app',
    credentials_supported: [
      {
        id: 'MobileDrivingLicence',
        types: ['VerifiableCredential', 'MobileDrivingLicence'],
        format: 'jwt',
        cryptographic_binding_methods_supported: ['did'],
        cryptographic_suites_supported: ['ES256'],
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

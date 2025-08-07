import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  const credentialOffer = {
    credential_offer: {
      credential_issuer: 'https://mdl-project.netlify.app',
      credential_endpoint: 'https://mdl-project.netlify.app/.netlify/functions/credential-issuer',
      credentials_supported: [
        {
          id: 'MobileDrivingLicence',
          types: ['VerifiableCredential', 'MobileDrivingLicence'],
          format: 'ldp_vc',
          cryptographic_binding_methods_supported: ['did'],
          cryptographic_suites_supported: ['Ed25519Signature2018'],
        },
      ],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': 'test-code-123',
          user_pin_required: false,
        },
      },
    },
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(credentialOffer),
  }
}


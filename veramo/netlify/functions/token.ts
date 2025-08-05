import { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  return {
    statusCode: 501,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not implemented',
      message: 'Token endpoint is not required for pre-authorized flow.',
    }),
  }
}

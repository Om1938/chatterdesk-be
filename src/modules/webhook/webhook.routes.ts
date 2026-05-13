import { FastifyInstance } from 'fastify'
import { WebhookController } from './webhook.controller.js'
import { WebhookService } from './webhook.service.js'
import { errorSchema } from '../../utils/schema.js'

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new WebhookService(fastify)
  const controller = new WebhookController(service)

  fastify.get(
    '/webhook/whatsapp',
    {
      schema: {
        tags: ['Webhook'],
        summary: 'WhatsApp webhook verification',
        description:
          'Meta calls this endpoint once when you register the webhook URL in the developer console. Returns `hub.challenge` as plain text.',
        security: [],
        querystring: {
          type: 'object',
          required: ['hub.mode', 'hub.verify_token', 'hub.challenge'],
          properties: {
            'hub.mode': { type: 'string', enum: ['subscribe'] },
            'hub.verify_token': { type: 'string' },
            'hub.challenge': { type: 'string' },
          },
        },
        response: {
          200: { type: 'string', description: 'Echo of hub.challenge' },
          403: errorSchema,
        },
      },
    },
    controller.verify.bind(controller),
  )

  fastify.post(
    '/webhook/whatsapp',
    {
      config: { rawBody: true },
      schema: {
        tags: ['Webhook'],
        summary: 'Receive WhatsApp events',
        description:
          'Meta posts all inbound messages and status updates here. Validates HMAC-SHA256 signature, persists the raw event, and publishes to Kafka.',
        security: [],
        headers: {
          type: 'object',
          properties: {
            'x-hub-signature-256': {
              type: 'string',
              description: 'HMAC-SHA256 signature of the request body',
            },
          },
        },
        body: {
          type: 'object',
          description: 'WhatsApp Cloud API webhook payload',
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'accepted' },
              eventId: { type: 'string', format: 'uuid' },
            },
          },
          401: errorSchema,
          400: errorSchema,
        },
      },
    },
    controller.receive.bind(controller),
  )
}

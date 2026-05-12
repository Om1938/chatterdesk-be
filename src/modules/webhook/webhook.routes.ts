import { FastifyInstance } from 'fastify'
import { WebhookController } from './webhook.controller.js'
import { WebhookService } from './webhook.service.js'

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new WebhookService(fastify)
  const controller = new WebhookController(service)

  // Meta/WhatsApp webhook verification (GET)
  fastify.get(
    '/webhook/whatsapp',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            'hub.mode': { type: 'string' },
            'hub.verify_token': { type: 'string' },
            'hub.challenge': { type: 'string' },
          },
        },
      },
    },
    controller.verify.bind(controller),
  )

  // WhatsApp webhook event receiver (POST)
  fastify.post(
    '/webhook/whatsapp',
    {
      config: { rawBody: true },
      schema: {
        body: { type: 'object' },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              eventId: { type: 'string' },
            },
          },
        },
      },
    },
    controller.receive.bind(controller),
  )
}

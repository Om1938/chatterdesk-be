import { FastifyRequest, FastifyReply } from 'fastify'
import { WebhookService } from './webhook.service.js'
import { WebhookVerifyQuerySchema } from './webhook.schema.js'
import { config } from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import { AppError } from '../../utils/errors.js'

export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  async verify(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = WebhookVerifyQuerySchema.safeParse(req.query)

    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid verification request' })
    }

    const { 'hub.verify_token': token, 'hub.challenge': challenge } = result.data

    if (token !== config.WHATSAPP_VERIFY_TOKEN) {
      logger.warn('Webhook verification failed: token mismatch')
      return reply.status(403).send({ error: 'Forbidden' })
    }

    logger.info('WhatsApp webhook verified successfully')
    return reply.status(200).send(challenge)
  }

  async receive(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawBody = (req.rawBody as Buffer | undefined) ?? Buffer.from(JSON.stringify(req.body))
    const signature = req.headers[config.WEBHOOK_SIGNATURE_HEADER] as string | undefined

    try {
      this.service.verifySignature(rawBody, signature)

      const payload = this.service.parseAndValidate(req.body)
      const eventId = await this.service.persistAndPublish(payload, rawBody.toString('utf-8'))

      return reply.status(200).send({ status: 'accepted', eventId })
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn({ err, statusCode: err.statusCode }, 'Webhook request rejected')
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }
}

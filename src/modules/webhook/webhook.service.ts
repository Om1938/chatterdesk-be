import crypto from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { KafkaTopics } from '../../kafka/topics.js'
import { config } from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../utils/errors.js'
import {
  WhatsAppWebhookPayload,
  WhatsAppWebhookPayloadSchema,
  WhatsAppMessage,
  WhatsAppStatus,
} from '../../types/whatsapp.js'

export interface RawWebhookEvent {
  eventId: string
  tenantId: string
  phoneNumberId: string
  receivedAt: string
  payload: WhatsAppWebhookPayload
}

export interface InboundMessageEvent {
  eventId: string
  tenantId: string
  phoneNumberId: string
  waId: string
  profileName: string | null
  message: WhatsAppMessage
}

export interface StatusUpdateEvent {
  eventId: string
  tenantId: string
  phoneNumberId: string
  status: WhatsAppStatus
}

export class WebhookService {
  constructor(private readonly fastify: FastifyInstance) {}

  verifySignature(rawBody: Buffer, signature: string | undefined): void {
    if (!signature) throw new WebhookSignatureError()

    const expected = `sha256=${crypto
      .createHmac('sha256', config.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest('hex')}`

    const sigBuffer = Buffer.from(signature)
    const expBuffer = Buffer.from(expected)

    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      throw new WebhookSignatureError()
    }
  }

  parseAndValidate(body: unknown): WhatsAppWebhookPayload {
    const result = WhatsAppWebhookPayloadSchema.safeParse(body)
    if (!result.success) {
      throw new WebhookValidationError(
        `Invalid webhook payload: ${result.error.issues.map((i) => i.message).join(', ')}`,
      )
    }
    return result.data
  }

  async persistAndPublish(
    payload: WhatsAppWebhookPayload,
    rawBody: string,
  ): Promise<string> {
    const eventId = crypto.randomUUID()
    const receivedAt = new Date()

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const phoneNumberId = change.value.metadata.phone_number_id

        // Resolve tenant from the WA phone number
        const waAccount = await this.fastify.prisma.whatsAppAccount.findUnique({
          where: { phoneNumberId, isActive: true },
          select: { tenantId: true },
        })

        if (!waAccount) {
          logger.warn({ phoneNumberId }, 'No active WA account found for phone_number_id — skipping')
          continue
        }

        const { tenantId } = waAccount

        // Persist raw event
        await this.fastify.prisma.webhookEvent.create({
          data: {
            id: eventId,
            tenantId,
            source: 'whatsapp',
            topic: KafkaTopics.WHATSAPP_WEBHOOK_RAW,
            rawPayload: rawBody,
            receivedAt,
          },
        })

        // Publish enriched raw event
        const rawEvent: RawWebhookEvent = {
          eventId,
          tenantId,
          phoneNumberId,
          receivedAt: receivedAt.toISOString(),
          payload,
        }

        await this.fastify.kafka.publish(
          KafkaTopics.WHATSAPP_WEBHOOK_RAW,
          rawEvent,
          { key: tenantId, headers: { 'x-event-type': 'whatsapp.webhook.raw' } },
        )

        // Fan-out messages
        if (change.value.messages?.length) {
          await this.publishMessages(eventId, tenantId, phoneNumberId, change.value)
        }

        // Fan-out status updates
        if (change.value.statuses?.length) {
          await this.publishStatuses(eventId, tenantId, phoneNumberId, change.value)
        }
      }
    }

    logger.info({ eventId }, 'Webhook event processed and published')
    return eventId
  }

  private async publishMessages(
    eventId: string,
    tenantId: string,
    phoneNumberId: string,
    value: WhatsAppWebhookPayload['entry'][number]['changes'][number]['value'],
  ): Promise<void> {
    const { messages = [], contacts = [] } = value

    const batch = messages.map((message) => {
      const contact = contacts.find((c) => c.wa_id === message.from)
      const event: InboundMessageEvent = {
        eventId,
        tenantId,
        phoneNumberId,
        waId: message.from,
        profileName: contact?.profile.name ?? null,
        message,
      }
      return {
        payload: event,
        options: {
          key: `${tenantId}:${message.from}`,
          headers: { 'x-event-type': 'whatsapp.message.inbound', 'x-tenant-id': tenantId },
        },
      }
    })

    await this.fastify.kafka.publishBatch(KafkaTopics.WHATSAPP_MESSAGES_INBOUND, batch)
  }

  private async publishStatuses(
    eventId: string,
    tenantId: string,
    phoneNumberId: string,
    value: WhatsAppWebhookPayload['entry'][number]['changes'][number]['value'],
  ): Promise<void> {
    const { statuses = [] } = value

    const batch = statuses.map((status) => {
      const event: StatusUpdateEvent = {
        eventId,
        tenantId,
        phoneNumberId,
        status,
      }
      return {
        payload: event,
        options: {
          key: `${tenantId}:${status.recipient_id}`,
          headers: { 'x-event-type': 'whatsapp.status.update', 'x-tenant-id': tenantId },
        },
      }
    })

    await this.fastify.kafka.publishBatch(KafkaTopics.WHATSAPP_STATUS_UPDATES, batch)
  }
}

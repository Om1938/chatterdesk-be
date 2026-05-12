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
  receivedAt: string
  payload: WhatsAppWebhookPayload
}

export interface InboundMessageEvent {
  eventId: string
  phoneNumberId: string
  waId: string
  profileName: string | null
  message: WhatsAppMessage
}

export interface StatusUpdateEvent {
  eventId: string
  phoneNumberId: string
  status: WhatsAppStatus
}

export class WebhookService {
  constructor(private readonly fastify: FastifyInstance) {}

  verifySignature(rawBody: Buffer, signature: string | undefined): void {
    if (!signature) {
      throw new WebhookSignatureError()
    }

    const expected = `sha256=${crypto
      .createHmac('sha256', config.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest('hex')}`

    // Constant-time comparison to prevent timing attacks
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

    // 1. Persist raw event to DB for auditability
    await this.fastify.prisma.webhookEvent.create({
      data: {
        id: eventId,
        source: 'whatsapp',
        topic: KafkaTopics.WHATSAPP_WEBHOOK_RAW,
        rawPayload: rawBody,
        receivedAt,
      },
    })

    // 2. Publish raw event to Kafka for fan-out
    const rawEvent: RawWebhookEvent = {
      eventId,
      receivedAt: receivedAt.toISOString(),
      payload,
    }

    await this.fastify.kafka.publish(KafkaTopics.WHATSAPP_WEBHOOK_RAW, rawEvent, {
      key: eventId,
      headers: { 'x-event-type': 'whatsapp.webhook.raw' },
    })

    // 3. Extract and fan-out messages + statuses
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { value } = change

        if (value.messages?.length) {
          await this.publishMessages(eventId, value)
        }

        if (value.statuses?.length) {
          await this.publishStatuses(eventId, value)
        }
      }
    }

    logger.info({ eventId }, 'Webhook event processed and published')

    return eventId
  }

  private async publishMessages(
    eventId: string,
    value: WhatsAppWebhookPayload['entry'][number]['changes'][number]['value'],
  ): Promise<void> {
    const { messages = [], contacts = [], metadata } = value

    const batch = messages.map((message) => {
      const contact = contacts.find((c) => c.wa_id === message.from)
      const event: InboundMessageEvent = {
        eventId,
        phoneNumberId: metadata.phone_number_id,
        waId: message.from,
        profileName: contact?.profile.name ?? null,
        message,
      }
      return {
        payload: event,
        options: { key: message.from, headers: { 'x-event-type': 'whatsapp.message.inbound' } },
      }
    })

    await this.fastify.kafka.publishBatch(KafkaTopics.WHATSAPP_MESSAGES_INBOUND, batch)
  }

  private async publishStatuses(
    eventId: string,
    value: WhatsAppWebhookPayload['entry'][number]['changes'][number]['value'],
  ): Promise<void> {
    const { statuses = [], metadata } = value

    const batch = statuses.map((status) => {
      const event: StatusUpdateEvent = {
        eventId,
        phoneNumberId: metadata.phone_number_id,
        status,
      }
      return {
        payload: event,
        options: {
          key: status.recipient_id,
          headers: { 'x-event-type': 'whatsapp.status.update' },
        },
      }
    })

    await this.fastify.kafka.publishBatch(KafkaTopics.WHATSAPP_STATUS_UPDATES, batch)
  }
}

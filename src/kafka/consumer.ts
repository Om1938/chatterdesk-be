import { Kafka, Consumer, EachMessagePayload } from 'kafkajs'
import { kafkaConfig } from '../config/kafka.js'
import { config } from '../config/index.js'
import { KafkaTopics } from './topics.js'
import { logger } from '../utils/logger.js'
import { PrismaClient } from '@prisma/client'
import { InboundMessageEvent, StatusUpdateEvent } from '../modules/webhook/webhook.service.js'

export class KafkaConsumerService {
  private readonly kafka: Kafka
  private consumer: Consumer | null = null
  private running = false

  constructor(private readonly prisma: PrismaClient) {
    this.kafka = new Kafka(kafkaConfig)
  }

  async connect(): Promise<void> {
    this.consumer = this.kafka.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
      maxBytesPerPartition: 1_048_576,
      retry: { initialRetryTime: 100, retries: 8 },
    })

    this.consumer.on('consumer.connect', () => logger.info('Kafka consumer connected'))
    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected')
      this.running = false
    })
    this.consumer.on('consumer.crash', ({ payload }) => {
      logger.error({ err: payload.error }, 'Kafka consumer crashed')
    })

    await this.consumer.connect()
    logger.info({ groupId: config.KAFKA_GROUP_ID }, 'Kafka consumer ready')
  }

  async start(): Promise<void> {
    if (!this.consumer) throw new Error('Consumer not connected')
    if (this.running) return

    await this.consumer.subscribe({
      topics: [
        KafkaTopics.WHATSAPP_WEBHOOK_RAW,
        KafkaTopics.WHATSAPP_MESSAGES_INBOUND,
        KafkaTopics.WHATSAPP_STATUS_UPDATES,
      ],
      fromBeginning: false,
    })

    this.running = true

    await this.consumer.run({
      autoCommit: true,
      autoCommitInterval: 5_000,
      autoCommitThreshold: 100,
      eachMessage: async (payload) => this.routeMessage(payload),
    })

    logger.info('Kafka consumer started')
  }

  private async routeMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload
    const rawValue = message.value?.toString()

    if (!rawValue) {
      logger.warn({ topic, partition, offset: message.offset }, 'Empty Kafka message, skipping')
      return
    }

    const log = logger.child({
      topic,
      partition,
      offset: message.offset,
      key: message.key?.toString(),
    })

    try {
      switch (topic) {
        case KafkaTopics.WHATSAPP_MESSAGES_INBOUND:
          await this.handleInboundMessage(rawValue, log)
          break
        case KafkaTopics.WHATSAPP_STATUS_UPDATES:
          await this.handleStatusUpdate(rawValue, log)
          break
        case KafkaTopics.WHATSAPP_WEBHOOK_RAW:
          log.debug('Raw webhook acknowledged')
          break
        default:
          log.warn('No handler for topic')
      }
    } catch (err) {
      log.error({ err }, 'Error processing Kafka message')
      await this.persistDlq(topic, rawValue, err)
    }
  }

  private async handleInboundMessage(raw: string, log: typeof logger): Promise<void> {
    const event = JSON.parse(raw) as InboundMessageEvent
    const { tenantId, phoneNumberId, waId, profileName, message, eventId } = event

    // Upsert contact
    const contact = await this.prisma.waContact.upsert({
      where: { tenantId_waId: { tenantId, waId } },
      create: { tenantId, waId, name: profileName ?? null },
      update: { ...(profileName ? { name: profileName } : {}) },
    })

    // Resolve WA account
    const waAccount = await this.prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
      select: { id: true },
    })

    if (!waAccount) {
      log.warn({ phoneNumberId }, 'WA account not found, cannot persist message')
      return
    }

    // Upsert conversation
    const conversation = await this.prisma.conversation.upsert({
      where: { waAccountId_contactId: { waAccountId: waAccount.id, contactId: contact.id } },
      create: {
        tenantId,
        waAccountId: waAccount.id,
        contactId: contact.id,
        status: 'OPEN',
        lastMessageAt: new Date(Number(message.timestamp) * 1000),
      },
      update: {
        status: 'OPEN',
        lastMessageAt: new Date(Number(message.timestamp) * 1000),
      },
    })

    // Persist message (idempotent on waMessageId)
    await this.prisma.message.upsert({
      where: { waMessageId: message.id },
      create: {
        conversationId: conversation.id,
        waMessageId: message.id,
        direction: 'INBOUND',
        type: message.type,
        content: message as object,
        status: 'RECEIVED',
        sentAt: new Date(Number(message.timestamp) * 1000),
      },
      update: {},
    })

    // Mark webhook event as processed
    await this.prisma.webhookEvent
      .update({ where: { id: eventId }, data: { processedAt: new Date() } })
      .catch(() => {})

    log.info({ conversationId: conversation.id, waId }, 'Inbound message persisted')
  }

  private async handleStatusUpdate(raw: string, log: typeof logger): Promise<void> {
    const event = JSON.parse(raw) as StatusUpdateEvent
    const { status } = event

    const statusMap: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    }

    const mapped = statusMap[status.status]
    if (!mapped) {
      log.warn({ status: status.status }, 'Unknown WA message status, skipping')
      return
    }

    await this.prisma.message
      .update({
        where: { waMessageId: status.id },
        data: { status: mapped },
      })
      .catch(() => {
        // Message may not exist if we're receiving a status for an outbound message
        // that was sent outside this system — non-fatal
        log.debug({ waMessageId: status.id }, 'Status update target message not found')
      })

    log.info({ waMessageId: status.id, status: mapped }, 'Message status updated')
  }

  private async persistDlq(topic: string, raw: string, err: unknown): Promise<void> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          source: 'kafka-dlq',
          topic,
          rawPayload: raw,
          processingError: err instanceof Error ? err.message : String(err),
        },
      })
    } catch (dbErr) {
      logger.error({ dbErr }, 'Failed to persist DLQ entry')
    }
  }

  async disconnect(): Promise<void> {
    if (this.consumer && this.running) {
      await this.consumer.disconnect()
      this.running = false
      logger.info('Kafka consumer disconnected gracefully')
    }
  }
}

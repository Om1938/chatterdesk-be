import { Kafka, Consumer, EachMessagePayload } from 'kafkajs'
import { kafkaConfig } from '../config/kafka.js'
import { config } from '../config/index.js'
import { KafkaTopics } from './topics.js'
import { logger } from '../utils/logger.js'
import { WhatsAppWebhookPayloadSchema } from '../types/whatsapp.js'
import { PrismaClient } from '@prisma/client'

export type MessageHandler = (payload: EachMessagePayload) => Promise<void>

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
      maxBytesPerPartition: 1_048_576, // 1 MB
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    })

    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected')
    })

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected')
      this.running = false
    })

    this.consumer.on('consumer.crash', ({ payload }) => {
      logger.error({ err: payload.error, groupId: payload.groupId }, 'Kafka consumer crashed')
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
      eachMessage: async (payload) => {
        await this.routeMessage(payload)
      },
    })

    logger.info('Kafka consumer started processing messages')
  }

  private async routeMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload
    const rawValue = message.value?.toString()

    if (!rawValue) {
      logger.warn({ topic, partition, offset: message.offset }, 'Received empty message, skipping')
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
        case KafkaTopics.WHATSAPP_WEBHOOK_RAW:
          await this.handleRawWebhook(rawValue, log)
          break
        case KafkaTopics.WHATSAPP_MESSAGES_INBOUND:
          await this.handleInboundMessage(rawValue, log)
          break
        case KafkaTopics.WHATSAPP_STATUS_UPDATES:
          await this.handleStatusUpdate(rawValue, log)
          break
        default:
          log.warn('No handler registered for topic')
      }
    } catch (err) {
      log.error({ err }, 'Error processing Kafka message')
      // Dead-letter: persist failure for ops visibility
      await this.persistProcessingError(topic, rawValue, err)
    }
  }

  private async handleRawWebhook(raw: string, log: typeof logger): Promise<void> {
    const parsed = JSON.parse(raw) as unknown
    const result = WhatsAppWebhookPayloadSchema.safeParse(parsed)

    if (!result.success) {
      log.warn({ issues: result.error.issues }, 'Raw webhook payload failed schema validation')
      return
    }

    log.info({ entries: result.data.entry.length }, 'Raw webhook validated and acknowledged')
  }

  private async handleInboundMessage(raw: string, log: typeof logger): Promise<void> {
    const data = JSON.parse(raw) as unknown
    log.info({ data }, 'Processing inbound WhatsApp message')

    await this.prisma.webhookEvent.update({
      where: { id: (data as { eventId?: string }).eventId ?? '' },
      data: { processedAt: new Date() },
    }).catch(() => {
      // Event may already be processed or eventId missing — non-fatal
    })
  }

  private async handleStatusUpdate(raw: string, log: typeof logger): Promise<void> {
    const data = JSON.parse(raw) as unknown
    log.info({ data }, 'Processing WhatsApp status update')
  }

  private async persistProcessingError(
    topic: string,
    raw: string,
    err: unknown,
  ): Promise<void> {
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
      logger.error({ dbErr }, 'Failed to persist processing error to DB')
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

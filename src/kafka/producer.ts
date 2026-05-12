import { Kafka, Producer, RecordMetadata, Message } from 'kafkajs'
import { kafkaConfig } from '../config/kafka.js'
import { TOPIC_DEFINITIONS, KafkaTopic } from './topics.js'
import { KafkaPublishError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export interface PublishOptions {
  key?: string
  headers?: Record<string, string>
  partition?: number
}

export class KafkaProducerService {
  private readonly kafka: Kafka
  private producer: Producer | null = null
  private connected = false

  constructor() {
    this.kafka = new Kafka(kafkaConfig)
  }

  async connect(): Promise<void> {
    if (this.connected) return

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30_000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    })

    this.producer.on('producer.connect', () => {
      logger.info('Kafka producer connected')
    })

    this.producer.on('producer.disconnect', () => {
      logger.warn('Kafka producer disconnected')
      this.connected = false
    })

    await this.producer.connect()
    this.connected = true
    logger.info({ brokers: kafkaConfig.brokers }, 'Kafka producer ready')
  }

  async ensureTopics(): Promise<void> {
    const admin = this.kafka.admin()
    await admin.connect()

    try {
      const existing = new Set(await admin.listTopics())
      const toCreate = TOPIC_DEFINITIONS.filter((t) => !existing.has(t.topic))

      if (toCreate.length > 0) {
        await admin.createTopics({
          topics: toCreate.map((t) => ({
            topic: t.topic,
            numPartitions: t.numPartitions,
            replicationFactor: t.replicationFactor,
            configEntries: [...t.configEntries],
          })),
          waitForLeaders: true,
        })
        logger.info({ topics: toCreate.map((t) => t.topic) }, 'Kafka topics created')
      }
    } finally {
      await admin.disconnect()
    }
  }

  async publish<T>(
    topic: KafkaTopic,
    payload: T,
    options: PublishOptions = {},
  ): Promise<RecordMetadata[]> {
    if (!this.producer || !this.connected) {
      throw new KafkaPublishError(topic, new Error('Producer not connected'))
    }

    const message: Message = {
      value: JSON.stringify(payload),
      timestamp: Date.now().toString(),
      headers: {
        'content-type': 'application/json',
        'x-source': 'chatterdesk',
        ...options.headers,
      },
    }

    if (options.key !== undefined) {
      message.key = options.key
    }

    if (options.partition !== undefined) {
      message.partition = options.partition
    }

    try {
      const result = await this.producer.send({ topic, messages: [message] })
      logger.debug({ topic, key: options.key }, 'Message published to Kafka')
      return result
    } catch (err) {
      logger.error({ err, topic }, 'Failed to publish to Kafka')
      throw new KafkaPublishError(topic, err)
    }
  }

  async publishBatch<T>(
    topic: KafkaTopic,
    payloads: Array<{ payload: T; options?: PublishOptions }>,
  ): Promise<RecordMetadata[]> {
    if (!this.producer || !this.connected) {
      throw new KafkaPublishError(topic, new Error('Producer not connected'))
    }

    const messages: Message[] = payloads.map(({ payload, options = {} }) => {
      const msg: Message = {
        value: JSON.stringify(payload),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'x-source': 'chatterdesk',
          ...options.headers,
        },
      }
      if (options.key !== undefined) msg.key = options.key
      if (options.partition !== undefined) msg.partition = options.partition
      return msg
    })

    try {
      return await this.producer.send({ topic, messages })
    } catch (err) {
      logger.error({ err, topic }, 'Failed to publish batch to Kafka')
      throw new KafkaPublishError(topic, err)
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer && this.connected) {
      await this.producer.disconnect()
      this.connected = false
      logger.info('Kafka producer disconnected gracefully')
    }
  }
}

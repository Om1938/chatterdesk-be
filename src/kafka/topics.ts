export const KafkaTopics = {
  WHATSAPP_WEBHOOK_RAW: 'whatsapp.webhook.raw',
  WHATSAPP_MESSAGES_INBOUND: 'whatsapp.messages.inbound',
  WHATSAPP_STATUS_UPDATES: 'whatsapp.status.updates',
  WHATSAPP_DLQ: 'whatsapp.webhook.dlq',
} as const

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics]

export const TOPIC_DEFINITIONS = [
  {
    topic: KafkaTopics.WHATSAPP_WEBHOOK_RAW,
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) }, // 7 days
      { name: 'compression.type', value: 'gzip' },
    ],
  },
  {
    topic: KafkaTopics.WHATSAPP_MESSAGES_INBOUND,
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(30 * 24 * 60 * 60 * 1000) }, // 30 days
      { name: 'compression.type', value: 'gzip' },
    ],
  },
  {
    topic: KafkaTopics.WHATSAPP_STATUS_UPDATES,
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    topic: KafkaTopics.WHATSAPP_DLQ,
    numPartitions: 1,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: String(30 * 24 * 60 * 60 * 1000) },
    ],
  },
] as const

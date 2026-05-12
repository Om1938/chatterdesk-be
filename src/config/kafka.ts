import { Kafka, KafkaConfig, SASLOptions } from 'kafkajs'
import { config } from './index.js'

function buildSasl(): SASLOptions | undefined {
  if (!config.KAFKA_SASL_MECHANISM) {
    return undefined
  }

  if (!config.KAFKA_SASL_USERNAME || !config.KAFKA_SASL_PASSWORD) {
    throw new Error(
      'KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD are required when SASL is enabled',
    )
  }

  return {
    mechanism: config.KAFKA_SASL_MECHANISM,
    username: config.KAFKA_SASL_USERNAME,
    password: config.KAFKA_SASL_PASSWORD,
  }
}

function buildKafkaConfig(): KafkaConfig {
  const sasl = buildSasl()

  const base: KafkaConfig = {
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS,
    ssl: config.KAFKA_SSL,
    retry: {
      initialRetryTime: 300,
      retries: 10,
      multiplier: 1.5,
      maxRetryTime: 30_000,
    },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    logLevel: config.NODE_ENV === 'development' ? 2 : 1,
  }

  if (sasl !== undefined) {
    base.sasl = sasl
  }

  return base
}

export const kafkaConfig = buildKafkaConfig()

export { Kafka }

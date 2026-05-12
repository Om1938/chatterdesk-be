import { buildApp } from './app.js'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'
import { KafkaConsumerService } from './kafka/consumer.js'

async function main(): Promise<void> {
  const app = await buildApp()

  // Start Kafka consumer (separate from the Fastify lifecycle)
  const consumer = new KafkaConsumerService(app.prisma)
  await consumer.connect()
  await consumer.start()

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received')
    try {
      await app.close()
      await consumer.disconnect()
      logger.info('Graceful shutdown complete')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception')
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection')
    process.exit(1)
  })

  await app.listen({ port: config.PORT, host: config.HOST })
  logger.info({ port: config.PORT, host: config.HOST }, 'Server listening')
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error')
  process.exit(1)
})

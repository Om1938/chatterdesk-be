import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { KafkaProducerService } from '../kafka/producer.js'
import { logger } from '../utils/logger.js'

async function kafkaPlugin(fastify: FastifyInstance): Promise<void> {
  const producer = new KafkaProducerService()

  await producer.connect()
  await producer.ensureTopics()

  fastify.decorate('kafka', producer)

  fastify.addHook('onClose', async () => {
    await producer.disconnect()
    logger.info('Kafka producer shut down')
  })
}

export default fp(kafkaPlugin, {
  name: 'kafka',
  fastify: '5.x',
})

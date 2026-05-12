import { PrismaClient } from '@prisma/client'
import { KafkaProducerService } from '../kafka/producer.js'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    kafka: KafkaProducerService
  }

  interface FastifyRequest {
    rawBody?: Buffer
  }

  interface FastifyContextConfig {
    rawBody?: boolean
  }
}

import { PrismaClient } from '@prisma/client'
import { KafkaProducerService } from '../kafka/producer.js'
import { UserRole } from '../types/auth.js'

export interface JwtPayload {
  sub: string       // userId
  tenantId: string
  role: UserRole
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    kafka: KafkaProducerService
  }

  interface FastifyRequest {
    rawBody?: Buffer
    user: JwtPayload
  }

  interface FastifyContextConfig {
    rawBody?: boolean
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

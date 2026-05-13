import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

async function prismaPlugin(fastify: FastifyInstance): Promise<void> {
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL })

  const prisma = new PrismaClient({
    adapter,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  })

  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Prisma query')
  })

  prisma.$on('error', (e) => {
    logger.error({ message: e.message }, 'Prisma error')
  })

  prisma.$on('warn', (e) => {
    logger.warn({ message: e.message }, 'Prisma warning')
  })

  await prisma.$connect()
  logger.info('Prisma client connected')

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
    logger.info('Prisma client disconnected')
  })
}

export default fp(prismaPlugin, {
  name: 'prisma',
  fastify: '5.x',
})

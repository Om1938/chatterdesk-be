import { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      return reply.send({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    },
  )

  fastify.get(
    '/health/ready',
    {},
    async (_req, reply) => {
      try {
        await fastify.prisma.$queryRaw`SELECT 1`
        return reply.send({ status: 'ready', db: 'ok' })
      } catch {
        return reply.status(503).send({ status: 'not_ready', db: 'error' })
      }
    },
  )
}

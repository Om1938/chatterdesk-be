import { FastifyInstance } from 'fastify'

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Returns 200 if the server process is alive.',
        security: [],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              uptime: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
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
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Returns 200 if the database connection is healthy.',
        security: [],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ready' },
              db: { type: 'string', example: 'ok' },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'not_ready' },
              db: { type: 'string', example: 'error' },
            },
          },
        },
      },
    },
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

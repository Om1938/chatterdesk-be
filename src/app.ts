import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/index.js'
import { logger } from './utils/logger.js'

import sensiblePlugin from './plugins/sensible.js'
import cookiePlugin from './plugins/cookie.js'
import jwtPlugin from './plugins/jwt.js'
import prismaPlugin from './plugins/prisma.js'
import kafkaPlugin from './plugins/kafka.js'
import swaggerPlugin from './plugins/swagger.js'

import { healthRoutes } from './modules/health/health.routes.js'
import { webhookRoutes } from './modules/webhook/webhook.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { conversationRoutes } from './modules/conversations/conversation.routes.js'

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger, trustProxy: true })

  // Capture raw body buffer for HMAC signature verification
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      try {
        req.rawBody = body as Buffer
        const json: unknown = JSON.parse((body as Buffer).toString('utf-8'))
        done(null, json)
      } catch (err) {
        done(err as Error, undefined)
      }
    },
  )

  // ── Security ─────────────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  })

  // ── Plugins (order matters: swagger first, then cookie → jwt → prisma → kafka) ─
  await app.register(swaggerPlugin)
  await app.register(sensiblePlugin)
  await app.register(cookiePlugin)
  await app.register(jwtPlugin)
  await app.register(prismaPlugin)
  await app.register(kafkaPlugin)

  // ── Routes ────────────────────────────────────────────────────────────────────
  const v1 = '/api/v1'
  await app.register(healthRoutes, { prefix: v1 })
  await app.register(webhookRoutes, { prefix: v1 })
  await app.register(authRoutes, { prefix: v1 })
  await app.register(conversationRoutes, { prefix: v1 })

  // ── Global error handler ──────────────────────────────────────────────────────
  app.setErrorHandler((error: FastifyError, req, reply) => {
    req.log.error({ err: error, url: req.url, method: req.method }, 'Unhandled error')
    const statusCode = error.statusCode ?? 500
    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      code: error.code ?? 'UNKNOWN_ERROR',
    })
  })

  app.setNotFoundHandler((_req, reply) => {
    return reply.status(404).send({ error: 'Not Found', code: 'NOT_FOUND' })
  })

  return app
}

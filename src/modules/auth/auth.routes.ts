import { FastifyInstance } from 'fastify'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { authenticate } from '../../middleware/authenticate.js'

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new AuthService(fastify)
  const controller = new AuthController(service)

  // Public routes
  fastify.post('/auth/register', controller.register.bind(controller))
  fastify.post('/auth/login', controller.login.bind(controller))
  fastify.post('/auth/refresh', controller.refresh.bind(controller))

  // Authenticated
  fastify.post(
    '/auth/logout',
    { preHandler: [authenticate] },
    controller.logout.bind(controller),
  )
  fastify.get(
    '/auth/me',
    { preHandler: [authenticate] },
    controller.me.bind(controller),
  )
}

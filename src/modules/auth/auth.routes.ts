import { FastifyInstance } from 'fastify'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { authenticate } from '../../middleware/authenticate.js'
import { s, errorSchema } from '../../utils/schema.js'
import {
  RegisterSchema,
  LoginSchema,
} from './auth.schema.js'
import { z } from 'zod'

const UserResponseSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  role: z.enum(['OWNER', 'ADMIN', 'AGENT', 'VIEWER']),
})

const MeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'AGENT', 'VIEWER']),
  tenantId: z.string().uuid(),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  }),
})

const tenantHeader = {
  type: 'object',
  required: ['x-tenant-id'],
  properties: {
    'x-tenant-id': {
      type: 'string',
      format: 'uuid',
      description: 'Must match the tenantId embedded in the JWT',
    },
  },
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new AuthService(fastify)
  const controller = new AuthController(service)

  fastify.post('/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new tenant + owner account',
      description: 'Creates the tenant and its first OWNER user in one step. Sets `access_token` and `refresh_token` HTTP-only cookies on success.',
      security: [],
      body: s(RegisterSchema),
      response: {
        201: s(UserResponseSchema),
        409: errorSchema,
        400: errorSchema,
      },
    },
  }, controller.register.bind(controller))

  fastify.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login',
      description: 'Validates credentials and sets `access_token` (15 min) and `refresh_token` (7 days) as HTTP-only cookies.',
      security: [],
      body: s(LoginSchema),
      response: {
        200: s(UserResponseSchema),
        401: errorSchema,
      },
    },
  }, controller.login.bind(controller))

  fastify.post('/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: 'Reads the `refresh_token` cookie, rotates both tokens, and sets fresh cookies. The old refresh token is immediately invalidated.',
      security: [],
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        401: errorSchema,
      },
    },
  }, controller.refresh.bind(controller))

  fastify.post('/auth/logout', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout',
      description: 'Revokes the current session and clears both cookies.',
      headers: tenantHeader,
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    },
  }, controller.logout.bind(controller))

  fastify.get('/auth/me', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Current user',
      description: 'Returns the authenticated user and their tenant details.',
      headers: tenantHeader,
      response: {
        200: s(MeResponseSchema),
        404: errorSchema,
      },
    },
  }, controller.me.bind(controller))
}

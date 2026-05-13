import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

async function swaggerPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'ChatterDesk API',
        description: [
          'Multi-tenant WhatsApp shared inbox API.',
          '',
          '## Authentication',
          'All protected endpoints require a valid JWT issued by `POST /auth/login`.',
          'The token is set as an **HTTP-only cookie** (`access_token`) and sent automatically.',
          'Every request must also include the `x-tenant-id` header matching the tenant in the JWT.',
          '',
          '## Token Refresh',
          'Access tokens expire in 15 minutes. Call `POST /auth/refresh` to rotate both tokens.',
          'The refresh token is stored in a separate HTTP-only cookie (`refresh_token`).',
        ].join('\n'),
        version: '1.0.0',
        contact: {
          name: 'ChatterDesk',
          email: 'admin@ompdas.com',
        },
      },
      servers: [
        {
          url: 'https://chatter.ompdas.com/api/v1',
          description: 'Production',
        },
        {
          url: 'http://localhost:3000/api/v1',
          description: 'Local development',
        },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'access_token',
            description: 'HTTP-only JWT cookie set on login',
          },
        },
      },
      security: [{ cookieAuth: [] }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes' },
        { name: 'Auth', description: 'Register, login, token refresh, logout' },
        {
          name: 'Conversations',
          description: 'Shared inbox — list threads, read messages, send replies via WhatsApp Cloud API',
        },
        {
          name: 'Webhook',
          description: 'WhatsApp Cloud API inbound webhook receiver',
        },
      ],
    },
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    staticCSP: true,
    transformSpecificationClone: true,
  })
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '4.x',
})

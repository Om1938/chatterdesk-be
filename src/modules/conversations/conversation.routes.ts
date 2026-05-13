import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ConversationController } from './conversation.controller.js'
import { ConversationService } from './conversation.service.js'
import { authenticate, requireRole } from '../../middleware/authenticate.js'
import { s, errorSchema } from '../../utils/schema.js'
import {
  ListConversationsSchema,
  SendMessageSchema,
  UpdateConversationSchema,
} from './conversation.schema.js'

const tenantHeader = {
  type: 'object',
  required: ['x-tenant-id'],
  properties: {
    'x-tenant-id': { type: 'string', format: 'uuid' },
  },
}

const uuidParam = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
}

const ContactSchema = z.object({
  id: z.string().uuid(),
  waId: z.string(),
  name: z.string().nullable(),
})

const MessagePreviewSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  content: z.unknown(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  sentAt: z.string().datetime(),
})

const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: z.enum(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED']),
  lastMessageAt: z.string().datetime().nullable(),
  contact: ContactSchema,
  waAccount: z.object({ id: z.string().uuid(), displayPhone: z.string() }),
  messages: z.array(MessagePreviewSchema),
})

const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  waMessageId: z.string().nullable(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  type: z.string(),
  content: z.unknown(),
  status: z.enum(['RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']),
  sentAt: z.string().datetime(),
  sentBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
})

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new ConversationService(fastify)
  const controller = new ConversationController(service)

  const auth = [authenticate]
  const canSend = [authenticate, requireRole('OWNER', 'ADMIN', 'AGENT')]
  const canManage = [authenticate, requireRole('OWNER', 'ADMIN')]

  fastify.get('/conversations', {
    preHandler: auth,
    schema: {
      tags: ['Conversations'],
      summary: 'List conversations',
      description: 'Paginated inbox. Filter by status. Sorted by most recent message.',
      headers: tenantHeader,
      querystring: s(ListConversationsSchema),
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: s(ConversationSummarySchema) },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
                pages: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, controller.list.bind(controller))

  fastify.get<{ Params: { id: string } }>('/conversations/:id', {
    preHandler: auth,
    schema: {
      tags: ['Conversations'],
      summary: 'Get conversation with full message history',
      headers: tenantHeader,
      params: uuidParam,
      response: {
        200: s(ConversationSummarySchema),
        404: errorSchema,
      },
    },
  }, controller.getById.bind(controller))

  fastify.patch<{ Params: { id: string } }>('/conversations/:id', {
    preHandler: canManage,
    schema: {
      tags: ['Conversations'],
      summary: 'Update conversation status or assignment',
      description: 'Set `status` to change conversation state. Set `assignedUserId` to assign to an agent (must belong to same tenant).',
      headers: tenantHeader,
      params: uuidParam,
      body: s(UpdateConversationSchema),
      response: {
        200: { type: 'object', description: 'Updated conversation' },
        404: errorSchema,
      },
    },
  }, controller.update.bind(controller))

  fastify.post<{ Params: { id: string } }>('/conversations/:id/messages', {
    preHandler: canSend,
    schema: {
      tags: ['Conversations'],
      summary: 'Send a reply',
      description: 'Sends a message via the WhatsApp Cloud API using the credentials of the WA account linked to this conversation. Persists the outbound message to the DB.',
      headers: tenantHeader,
      params: uuidParam,
      body: s(SendMessageSchema),
      response: {
        201: s(MessageSchema),
        400: errorSchema,
        404: errorSchema,
        502: errorSchema,
      },
    },
  }, controller.sendMessage.bind(controller))
}

import { FastifyInstance } from 'fastify'
import { ConversationController } from './conversation.controller.js'
import { ConversationService } from './conversation.service.js'
import { authenticate, requireRole } from '../../middleware/authenticate.js'

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new ConversationService(fastify)
  const controller = new ConversationController(service)

  const auth = [authenticate]
  const canSend = [authenticate, requireRole('OWNER', 'ADMIN', 'AGENT')]
  const canManage = [authenticate, requireRole('OWNER', 'ADMIN')]

  // Inbox list
  fastify.get('/conversations', { preHandler: auth }, controller.list.bind(controller))

  // Single conversation with full message history
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: auth },
    controller.getById.bind(controller),
  )

  // Update status or assignment
  fastify.patch<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: canManage },
    controller.update.bind(controller),
  )

  // Send reply via WhatsApp Cloud API
  fastify.post<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    { preHandler: canSend },
    controller.sendMessage.bind(controller),
  )
}

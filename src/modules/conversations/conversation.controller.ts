import { FastifyRequest, FastifyReply } from 'fastify'
import { ConversationService } from './conversation.service.js'
import {
  ListConversationsSchema,
  SendMessageSchema,
  UpdateConversationSchema,
} from './conversation.schema.js'
import { AppError } from '../../utils/errors.js'

export class ConversationController {
  constructor(private readonly service: ConversationService) {}

  async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = ListConversationsSchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const result = await this.service.list(req.user.tenantId, parsed.data)
    return reply.send(result)
  }

  async getById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const conversation = await this.service.getById(req.user.tenantId, req.params.id)
      return reply.send(conversation)
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }

  async update(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = UpdateConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    try {
      const result = await this.service.update(
        req.user.tenantId,
        req.params.id,
        parsed.data,
      )
      return reply.send(result)
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }

  async sendMessage(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = SendMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    try {
      const message = await this.service.sendMessage(
        req.user.tenantId,
        req.params.id,
        req.user.sub,
        parsed.data,
      )
      return reply.status(201).send(message)
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }
}

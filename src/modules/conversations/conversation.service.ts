import { FastifyInstance } from 'fastify'
import { AppError } from '../../utils/errors.js'
import { waCloudService, SendMessagePayload } from '../../services/whatsapp-cloud.js'
import {
  ListConversationsInput,
  SendMessageInput,
  UpdateConversationInput,
} from './conversation.schema.js'

export class ConversationService {
  constructor(private readonly fastify: FastifyInstance) {}

  async list(tenantId: string, input: ListConversationsInput) {
    const { status, page, limit } = input
    const skip = (page - 1) * limit

    const where = { tenantId, ...(status ? { status } : {}) }

    const [items, total] = await Promise.all([
      this.fastify.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          contact: { select: { id: true, waId: true, name: true } },
          waAccount: { select: { id: true, displayPhone: true } },
          assignments: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { id: true, type: true, content: true, direction: true, sentAt: true },
          },
        },
      }),
      this.fastify.prisma.conversation.count({ where }),
    ])

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    }
  }

  async getById(tenantId: string, conversationId: string) {
    const conversation = await this.fastify.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: true,
        waAccount: { select: { id: true, displayPhone: true, phoneNumberId: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
          include: { sentBy: { select: { id: true, name: true } } },
        },
      },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }
    return conversation
  }

  async update(tenantId: string, conversationId: string, input: UpdateConversationInput) {
    const conversation = await this.fastify.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    })
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    // Handle assignment separately
    if (input.assignedUserId !== undefined) {
      const user = await this.fastify.prisma.user.findFirst({
        where: { id: input.assignedUserId, tenantId },
      })
      if (!user) throw new AppError('User not found in this tenant', 404, 'NOT_FOUND')

      await this.fastify.prisma.conversationAssignment.upsert({
        where: { conversationId_userId: { conversationId, userId: input.assignedUserId } },
        create: { conversationId, userId: input.assignedUserId },
        update: { assignedAt: new Date() },
      })
    }

    return this.fastify.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        updatedAt: new Date(),
      },
    })
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    senderId: string,
    input: SendMessageInput,
  ) {
    const conversation = await this.fastify.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: true,
        waAccount: true,
      },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    const { waAccount, contact } = conversation

    // Build WA Cloud API payload
    let waPayload: SendMessagePayload
    if (input.type === 'text') {
      waPayload = { type: 'text', body: input.body ?? '' }
    } else {
      waPayload = {
        type: input.type,
        ...(input.mediaId !== undefined && { mediaId: input.mediaId }),
        ...(input.mediaUrl !== undefined && { mediaUrl: input.mediaUrl }),
        ...(input.caption !== undefined && { caption: input.caption }),
      }
    }

    const sentAt = new Date()

    // Call WA Cloud API
    let waMessageId: string | undefined
    let status: 'SENT' | 'FAILED' = 'SENT'

    try {
      const res = await waCloudService.sendMessage(
        waAccount.phoneNumberId,
        waAccount.accessToken,
        contact.waId,
        waPayload,
      )
      waMessageId = res.messages[0]?.id
    } catch (err) {
      status = 'FAILED'
      // Persist failed message for visibility, then rethrow
      await this.fastify.prisma.message.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          type: input.type,
          content: input as object,
          status: 'FAILED',
          sentAt,
          sentByUserId: senderId,
        },
      })
      throw err
    }

    // Persist successful message + update conversation timestamp
    const [message] = await this.fastify.prisma.$transaction([
      this.fastify.prisma.message.create({
        data: {
          conversationId,
          waMessageId: waMessageId ?? null,
          direction: 'OUTBOUND',
          type: input.type,
          content: input as object,
          status,
          sentAt,
          sentByUserId: senderId,
        },
        include: { sentBy: { select: { id: true, name: true } } },
      }),
      this.fastify.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: sentAt },
      }),
    ])

    return message
  }
}

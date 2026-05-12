import { z } from 'zod'

export const ListConversationsSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const UpdateConversationSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED']).optional(),
  assignedUserId: z.string().uuid().optional(),
})

export const SendMessageSchema = z.object({
  type: z.enum(['text', 'image', 'audio', 'video', 'document']),
  body: z.string().min(1).max(4096).optional(),
  mediaId: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
}).refine(
  (v) => v.type === 'text' ? !!v.body : !!(v.mediaId ?? v.mediaUrl),
  { message: 'text type requires body; media types require mediaId or mediaUrl' },
)

export type ListConversationsInput = z.infer<typeof ListConversationsSchema>
export type SendMessageInput = z.infer<typeof SendMessageSchema>
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>

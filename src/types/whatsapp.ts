import { z } from 'zod'

// ── WhatsApp Cloud API webhook payload types ──────────────────────────────────

export const WhatsAppMessageTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'contacts',
  'interactive',
  'order',
  'system',
  'unknown',
  'reaction',
  'sticker',
  'button',
])

export const WhatsAppTextSchema = z.object({
  body: z.string(),
})

export const WhatsAppMediaSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: z.string().optional(),
  filename: z.string().optional(),
})

export const WhatsAppLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
})

export const WhatsAppReactionSchema = z.object({
  message_id: z.string(),
  emoji: z.string(),
})

export const WhatsAppMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: WhatsAppMessageTypeSchema,
  text: WhatsAppTextSchema.optional(),
  image: WhatsAppMediaSchema.optional(),
  audio: WhatsAppMediaSchema.optional(),
  video: WhatsAppMediaSchema.optional(),
  document: WhatsAppMediaSchema.optional(),
  location: WhatsAppLocationSchema.optional(),
  reaction: WhatsAppReactionSchema.optional(),
  context: z
    .object({
      from: z.string(),
      id: z.string(),
    })
    .optional(),
})

export const WhatsAppStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        title: z.string(),
        message: z.string().optional(),
        error_data: z.object({ details: z.string() }).optional(),
      }),
    )
    .optional(),
})

export const WhatsAppContactSchema = z.object({
  profile: z.object({ name: z.string() }),
  wa_id: z.string(),
})

export const WhatsAppValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppMessageSchema).optional(),
  statuses: z.array(WhatsAppStatusSchema).optional(),
  errors: z
    .array(z.object({ code: z.number(), title: z.string() }))
    .optional(),
})

export const WhatsAppWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: WhatsAppValueSchema,
          field: z.literal('messages'),
        }),
      ),
    }),
  ),
})

export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>
export type WhatsAppValue = z.infer<typeof WhatsAppValueSchema>
export type WhatsAppMessageType = z.infer<typeof WhatsAppMessageTypeSchema>

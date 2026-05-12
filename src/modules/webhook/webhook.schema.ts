import { z } from 'zod'

export const WebhookVerifyQuerySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
})

export const WebhookEventSchema = z.object({
  object: z.string(),
  entry: z.array(z.unknown()),
})

export type WebhookVerifyQuery = z.infer<typeof WebhookVerifyQuerySchema>

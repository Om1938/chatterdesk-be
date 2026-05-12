import { z } from 'zod'

export const RegisterSchema = z.object({
  tenantName: z.string().min(2).max(256),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  ownerName: z.string().min(2).max(256),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(128),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
})

export const RefreshSchema = z.object({
  // refresh_token comes from the HTTP-only cookie, not body
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>

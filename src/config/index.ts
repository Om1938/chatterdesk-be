import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Kafka
  KAFKA_BROKERS: z
    .string()
    .transform((v) => v.split(',').map((b) => b.trim())),
  KAFKA_CLIENT_ID: z.string().default('chatterdesk'),
  KAFKA_GROUP_ID: z.string().default('chatterdesk-consumers'),
  KAFKA_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default(false),
  KAFKA_SASL_MECHANISM: z
    .string()
    .optional()
    .transform(
      (v) =>
        (v === '' ? undefined : v) as
          | 'plain'
          | 'scram-sha-256'
          | 'scram-sha-512'
          | undefined,
    ),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),

  // WhatsApp (platform-level — used for the shared webhook endpoint)
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),

  // WhatsApp Cloud API
  WA_GRAPH_API_BASE: z.string().url().default('https://graph.facebook.com'),
  WA_GRAPH_API_VERSION: z.string().default('v21.0'),

  WEBHOOK_SIGNATURE_HEADER: z.string().default('x-hub-signature-256'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

export type Config = typeof config

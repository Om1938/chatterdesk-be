// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — zodToJsonSchema overloads cause TS2589 (excessive type depth); runtime is correct.
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Converts a Zod schema to an OpenAPI 3.0-compatible JSON Schema object
 * for use in Fastify route `schema` definitions.
 */
export function s(schema: unknown): Record<string, unknown> {
  return zodToJsonSchema(schema as never, { target: 'openApi3' }) as Record<string, unknown>
}

export const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
  },
} as const

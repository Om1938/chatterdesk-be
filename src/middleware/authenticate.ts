import { FastifyRequest, FastifyReply } from 'fastify'
import { UserRole } from '../types/auth.js'

export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  const tenantId = req.headers['x-tenant-id']

  if (typeof tenantId !== 'string' || tenantId !== req.user.tenantId) {
    return reply
      .status(403)
      .send({ error: 'Tenant mismatch', code: 'TENANT_MISMATCH' })
  }
}

export function requireRole(
  ...roles: UserRole[]
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req, reply) => {
    if (!roles.includes(req.user.role)) {
      return reply
        .status(403)
        .send({ error: 'Insufficient permissions', code: 'FORBIDDEN' })
    }
  }
}

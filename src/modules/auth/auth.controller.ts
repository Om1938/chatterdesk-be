import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from './auth.service.js'
import { RegisterSchema, LoginSchema } from './auth.schema.js'
import { AppError } from '../../utils/errors.js'

export class AuthController {
  constructor(private readonly service: AuthService) {}

  async register(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = RegisterSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const result = await this.service.register(parsed.data)
    const { accessToken, refreshToken } = await this.service.login({
      email: parsed.data.ownerEmail,
      password: parsed.data.ownerPassword,
      tenantSlug: parsed.data.slug,
    })

    const cookies = this.service.buildCookies(accessToken, refreshToken)
    reply
      .setCookie(cookies.access.name, cookies.access.value, cookies.access.options)
      .setCookie(cookies.refresh.name, cookies.refresh.value, cookies.refresh.options)

    return reply.status(201).send({
      tenantId: result.tenantId,
      userId: result.userId,
      role: result.role,
    })
  }

  async login(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    try {
      const { accessToken, refreshToken, payload } =
        await this.service.login(parsed.data)

      const cookies = this.service.buildCookies(accessToken, refreshToken)
      reply
        .setCookie(cookies.access.name, cookies.access.value, cookies.access.options)
        .setCookie(cookies.refresh.name, cookies.refresh.value, cookies.refresh.options)

      return reply.send({
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      })
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }

  async refresh(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawRefreshToken = req.cookies['refresh_token']

    try {
      const { accessToken, refreshToken } =
        await this.service.refresh(rawRefreshToken)

      const cookies = this.service.buildCookies(accessToken, refreshToken)
      reply
        .setCookie(cookies.access.name, cookies.access.value, cookies.access.options)
        .setCookie(cookies.refresh.name, cookies.refresh.value, cookies.refresh.options)

      return reply.send({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code })
      }
      throw err
    }
  }

  async logout(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const rawRefreshToken = req.cookies['refresh_token']
    await this.service.logout(rawRefreshToken)

    const cookies = this.service.clearCookies()
    reply
      .setCookie(cookies.access.name, '', cookies.access.options)
      .setCookie(cookies.refresh.name, '', cookies.refresh.options)

    return reply.send({ ok: true })
  }

  async me(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await req.server.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
      },
    })

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  }
}

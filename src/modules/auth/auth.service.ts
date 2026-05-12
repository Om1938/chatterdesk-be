import { FastifyInstance } from 'fastify'
import { config } from '../../config/index.js'
import {
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  hashRefreshToken,
} from '../../utils/hash.js'
import { AppError } from '../../utils/errors.js'
import { RegisterInput, LoginInput } from './auth.schema.js'
import { JwtPayload } from '../../types/fastify.js'

const REFRESH_TOKEN_COOKIE = 'refresh_token'
const ACCESS_TOKEN_COOKIE = 'access_token'
const REFRESH_TTL_MS =
  config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000

const cookieBase = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
}

export class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  async register(input: RegisterInput) {
    const existing = await this.fastify.prisma.tenant.findUnique({
      where: { slug: input.slug },
    })
    if (existing) {
      throw new AppError('Slug already taken', 409, 'SLUG_TAKEN')
    }

    const passwordHash = await hashPassword(input.ownerPassword)

    const tenant = await this.fastify.prisma.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.slug,
        users: {
          create: {
            name: input.ownerName,
            email: input.ownerEmail,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    })

    const owner = tenant.users[0]
    if (!owner) throw new AppError('User creation failed', 500)

    return { tenantId: tenant.id, userId: owner.id, role: owner.role }
  }

  async login(input: LoginInput) {
    const tenant = await this.fastify.prisma.tenant.findUnique({
      where: { slug: input.tenantSlug, isActive: true },
    })
    if (!tenant) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    const user = await this.fastify.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: input.email },
      },
    })
    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    return this.issueTokens({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role as JwtPayload['role'],
    })
  }

  async refresh(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      throw new AppError('Missing refresh token', 401, 'MISSING_REFRESH_TOKEN')
    }

    const tokenHash = hashRefreshToken(rawRefreshToken)

    const session = await this.fastify.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: { include: { tenant: true } } },
    })

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      throw new AppError('Invalid or expired session', 401, 'SESSION_EXPIRED')
    }

    // Rotate: delete old session, issue fresh pair
    await this.fastify.prisma.session.delete({ where: { id: session.id } })

    return this.issueTokens({
      sub: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role as JwtPayload['role'],
    })
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return

    const tokenHash = hashRefreshToken(rawRefreshToken)
    await this.fastify.prisma.session
      .delete({ where: { refreshTokenHash: tokenHash } })
      .catch(() => {
        // Already deleted or not found — safe to ignore
      })
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = this.fastify.jwt.sign(payload)

    const refreshToken = generateRefreshToken()
    const refreshTokenHash = hashRefreshToken(refreshToken)
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)

    await this.fastify.prisma.session.create({
      data: {
        userId: payload.sub,
        refreshTokenHash,
        expiresAt,
      },
    })

    return { accessToken, refreshToken, payload }
  }

  buildCookies(accessToken: string, refreshToken: string) {
    return {
      access: {
        name: ACCESS_TOKEN_COOKIE,
        value: accessToken,
        options: {
          ...cookieBase,
          maxAge: 15 * 60, // 15 min in seconds
          path: '/',
        },
      },
      refresh: {
        name: REFRESH_TOKEN_COOKIE,
        value: refreshToken,
        options: {
          ...cookieBase,
          maxAge: config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,
          path: '/api/v1/auth', // only sent to auth endpoints
        },
      },
    }
  }

  clearCookies() {
    return {
      access: {
        name: ACCESS_TOKEN_COOKIE,
        options: { ...cookieBase, maxAge: 0, path: '/' },
      },
      refresh: {
        name: REFRESH_TOKEN_COOKIE,
        options: { ...cookieBase, maxAge: 0, path: '/api/v1/auth' },
      },
    }
  }
}

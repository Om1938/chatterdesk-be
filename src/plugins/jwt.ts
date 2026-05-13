import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import fjwt from '@fastify/jwt'
import { config } from '../config/index.js'

async function jwtPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fjwt, {
    secret: config.JWT_SECRET,
    // Read access token from HTTP-only cookie
    cookie: {
      cookieName: 'access_token',
      signed: false,
    },
    sign: {
      expiresIn: config.JWT_ACCESS_TTL,
    },
  })
}

export default fp(jwtPlugin, {
  name: 'jwt',
  fastify: '5.x',
  // cookie plugin must be registered first
  dependencies: ['cookie'],
})

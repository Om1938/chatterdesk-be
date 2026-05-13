import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

async function cookiePlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cookie)
}

export default fp(cookiePlugin, { name: 'cookie', fastify: '5.x' })

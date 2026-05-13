import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'

async function sensiblePlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(sensible)
}

export default fp(sensiblePlugin, {
  name: 'sensible',
  fastify: '5.x',
})

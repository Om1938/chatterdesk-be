import path from 'node:path'
import { config as dotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env before Prisma CLI reads this config
dotenv({ path: path.resolve(__dirname, '.env') })

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
})

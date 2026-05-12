'use strict'

/**
 * PM2 Ecosystem Config
 *
 * Usage:
 *   npm run pm2:start              # start with current NODE_ENV
 *   npm run pm2:start:prod         # force production env
 *   npm run pm2:reload             # zero-downtime reload (cluster)
 *   npm run pm2:stop
 *   npm run pm2:delete
 *   npm run pm2:logs
 *   npm run pm2:monit
 *
 * First-time server setup (run once as root/sudo):
 *   npx pm2 startup                # generate & enable systemd/launchd unit
 *   npm run pm2:start:prod
 *   npx pm2 save                   # persist process list across reboots
 */

/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: 'chatterdesk',
    script: 'dist/server.js',

    // ── Cluster mode ─────────────────────────────────────────────────────────
    // Spawns one process per logical CPU core; PM2 load-balances TCP connections.
    // Each instance joins the same Kafka consumer group so Kafka rebalances
    // partition assignments automatically across instances.
    instances: 'max',
    exec_mode: 'cluster',

    // ── Graceful startup / shutdown ───────────────────────────────────────────
    // wait_ready: PM2 waits for process.send('ready') before marking healthy.
    // listen_timeout: max ms to wait for the ready signal before marking failed.
    // kill_timeout: ms to wait for SIGINT handler to finish before sending SIGKILL.
    wait_ready: true,
    listen_timeout: 20_000,
    kill_timeout: 15_000,

    // ── Restart policy ────────────────────────────────────────────────────────
    max_memory_restart: '512M',
    restart_delay: 2_000,
    max_restarts: 10,
    min_uptime: '10s',

    // ── Logs ─────────────────────────────────────────────────────────────────
    // Pino writes structured JSON; these are the PM2-level stdout/stderr files.
    // Rotate with: npx pm2 install pm2-logrotate
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,   // merge all cluster instances into one log file

    // ── Source maps ──────────────────────────────────────────────────────────
    source_map_support: true,

    // ── Environment: development (default) ───────────────────────────────────
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
    },

    // ── Environment: production ───────────────────────────────────────────────
    // Activated via: pm2 start ecosystem.config.cjs --env production
    env_production: {
      NODE_ENV: 'production',
      PORT: '3000',
      LOG_LEVEL: 'info',
    },

    // ── Environment: staging ─────────────────────────────────────────────────
    env_staging: {
      NODE_ENV: 'production',
      PORT: '3001',
      LOG_LEVEL: 'debug',
    },
  },
]

module.exports = { apps }

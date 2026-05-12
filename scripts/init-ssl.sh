#!/usr/bin/env bash
# First-time SSL certificate issuance for chatter.ompdas.com
# Run once after docker compose up. Safe to re-run.
set -euo pipefail

DOMAIN="chatter.ompdas.com"
EMAIL="admin@ompdas.com"   # <-- change to your email for expiry alerts
SSL_CONF="nginx/conf.d/ssl.conf"
SSL_CONF_DISABLED="${SSL_CONF}.disabled"

echo "▶ Issuing Let's Encrypt certificate for ${DOMAIN}..."

docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --domain "${DOMAIN}"

echo "✔ Certificate issued."

# Enable the HTTPS Nginx config
if [ -f "${SSL_CONF_DISABLED}" ]; then
  mv "${SSL_CONF_DISABLED}" "${SSL_CONF}"
  echo "✔ SSL Nginx config enabled."
fi

# Reload Nginx to pick up the new config + certs
docker compose exec nginx nginx -s reload
echo "✔ Nginx reloaded."

echo ""
echo "✅ Done. https://${DOMAIN} is live."
echo "   Certbot will auto-renew every 12 hours."

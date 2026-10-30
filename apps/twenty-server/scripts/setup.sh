#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$APP_DIR/.env"
EXAMPLE_FILE="$APP_DIR/.env.example"

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate Twenty secrets." >&2
  exit 1
fi

umask 077
if [ ! -e "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

set_generated_secret() {
  name=$1
  current=$(sed -n "s/^${name}=//p" "$ENV_FILE" | tail -n 1)
  if [ -n "$current" ] && [ "$current" != "GENERATE_ME" ]; then
    return
  fi

  secret=$(openssl rand -hex 32)
  if grep -q "^${name}=" "$ENV_FILE"; then
    sed "s/^${name}=.*/${name}=${secret}/" "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$name" "$secret" >> "$ENV_FILE"
  fi
}

set_generated_secret PG_DATABASE_PASSWORD
set_generated_secret ENCRYPTION_KEY
set_generated_secret FALLBACK_ENCRYPTION_KEY
set_generated_secret APP_SECRET

database_user=$(sed -n 's/^PG_DATABASE_USER=//p' "$ENV_FILE" | tail -n 1)
database_password=$(sed -n 's/^PG_DATABASE_PASSWORD=//p' "$ENV_FILE" | tail -n 1)
database_name=$(sed -n 's/^PG_DATABASE_NAME=//p' "$ENV_FILE" | tail -n 1)
database_url="postgres://${database_user}:${database_password}@db:5432/${database_name}"
if grep -q '^PG_DATABASE_URL=' "$ENV_FILE"; then
  awk -v url="$database_url" '
    /^PG_DATABASE_URL=/ {
      if (!updated) print "PG_DATABASE_URL=" url
      updated = 1
      next
    }
    { print }
    END { if (!updated) print "PG_DATABASE_URL=" url }
  ' "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
else
  printf 'PG_DATABASE_URL=%s\n' "$database_url" >> "$ENV_FILE"
fi

chmod 600 "$ENV_FILE"

echo "Ensured $ENV_FILE has generated local secrets (file mode 600)."
echo "Review SERVER_URL before starting Twenty. Keep this file private."

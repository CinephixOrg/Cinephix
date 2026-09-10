#!/usr/bin/env bash
# Starts backend + Metro + an ngrok tunnel so the mobile app can be opened in
# Expo Go on a physical phone from inside a GitHub Codespace.
#
# Why this exists: `expo start --tunnel` is broken against modern ngrok
# accounts (the bundled @expo/ngrok wrapper speaks ngrok's old v2 dynamic-
# tunnel API, which ngrok v3 backends reject). This script runs Metro in
# `--host localhost` mode and drives ngrok directly instead, then points
# Metro's self-referential URLs at the tunnel via EXPO_PACKAGER_PROXY_URL
# (an intentionally .env-immune override in @expo/cli, read pre-dotenv to
# avoid a project's .env silently redirecting connected devices).
#
# Requires: a real ngrok v3 binary already swapped in at
# node_modules/@expo/ngrok-bin-linux-x64/ngrok, with `ngrok config
# add-authtoken <token>` already run once for this account.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE_DIR="$ROOT/mobile"
BACKEND_DIR="$ROOT/backend"
NGROK_BIN="$ROOT/node_modules/@expo/ngrok-bin-linux-x64/ngrok"
LOG_DIR="$MOBILE_DIR/.dev-logs"
mkdir -p "$LOG_DIR"

echo "== Stopping any previous instances =="
pkill -f "nodemon server.js" 2>/dev/null || true
# nodemon's own spawned child runs as a bare "node server.js" (no "nodemon"
# in its command line at all) — the pattern above only ever matches
# nodemon's wrapper process, not this child, so a child that outlives its
# wrapper (nodemon killed/crashed without cleaning up, or one abandoned by
# an earlier manual run) keeps holding port 5000 as a silent orphan: every
# *later* nodemon instance then crash-loops behind it with EADDRINUSE,
# while the orphan (running whatever stale on-disk state existed when *it*
# started) keeps answering every request. Hit this for real, twice, in one
# session — once as an immediate EADDRINUSE, once as a much sneakier
# "everything looks fine, individual requests just fail" a while later,
# since the stale process was otherwise perfectly healthy. Killing by port
# rather than by command-line pattern catches this regardless of how the
# orphan came to exist.
if command -v fuser >/dev/null 2>&1; then
  fuser -k 5000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti :5000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi
pkill -f "expo start" 2>/dev/null || true
pkill -f "@expo/ngrok-bin-linux-x64/ngrok" 2>/dev/null || true
sleep 1

echo "== Starting backend =="
(cd "$BACKEND_DIR" && npm run dev) > "$LOG_DIR/backend.log" 2>&1 &
disown
echo -n "Waiting for backend on :5000"
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:5000/api"; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
done

if [ -n "${CODESPACES:-}" ] && [ -n "${CODESPACE_NAME:-}" ] && command -v gh >/dev/null; then
  echo "== Making backend port 5000 public (Codespaces) =="
  gh codespace ports visibility 5000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
  BACKEND_PUBLIC_URL="https://${CODESPACE_NAME}-5000.app.github.dev"
  echo "Backend public URL: $BACKEND_PUBLIC_URL"
  {
    echo "EXPO_PUBLIC_API_BASE_URL=${BACKEND_PUBLIC_URL}/api"
    echo "EXPO_PUBLIC_SOCKET_URL=${BACKEND_PUBLIC_URL}"
  } > "$MOBILE_DIR/.env"

  # `gh codespace ports visibility` can silently no-op (rate limit, timing,
  # a transient API hiccup) — verify externally rather than trusting it, so
  # a broken tunnel fails loudly here instead of surfacing later as a
  # confusing "connect_error: server error" / non-JSON response deep inside
  # the app on a phone with no visibility into what actually went wrong.
  echo -n "Verifying backend port is actually public"
  PORT_PUBLIC=0
  for _ in $(seq 1 8); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND_PUBLIC_URL/api/health")" = "200" ]; then
      PORT_PUBLIC=1
      echo " confirmed."
      break
    fi
    echo -n "."
    gh codespace ports visibility 5000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
    sleep 1
  done
  if [ "$PORT_PUBLIC" = "0" ]; then
    echo ""
    echo "!! WARNING: backend port 5000 is still not publicly reachable"
    echo "!! ($BACKEND_PUBLIC_URL/api/health did not return 200)."
    echo "!! The app will fail to reach the backend from Expo Go until this"
    echo "!! is fixed — try: gh codespace ports visibility 5000:public -c $CODESPACE_NAME"
  fi
fi

echo "== Starting ngrok agent =="
"$NGROK_BIN" start --none --log=stdout > "$LOG_DIR/ngrok-agent.log" 2>&1 &
disown
echo -n "Waiting for ngrok local API"
for _ in $(seq 1 15); do
  if curl -s -o /dev/null "http://127.0.0.1:4040/api/tunnels"; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
done

echo "== Starting Metro (localhost mode, no proxy yet) =="
(cd "$MOBILE_DIR" && npx expo start --host localhost) > "$LOG_DIR/expo.log" 2>&1 &
disown
echo -n "Waiting for Metro on :8081"
for _ in $(seq 1 30); do
  if curl -s "http://localhost:8081/status" | grep -q "packager-status:running"; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
done

echo "== Opening ngrok tunnel to Metro (:8081) =="
TUNNEL_JSON=$(curl -s -X POST http://127.0.0.1:4040/api/tunnels \
  -H "Content-Type: application/json" \
  -d '{"proto":"http","addr":8081,"name":"metro"}')
TUNNEL_URL=$(echo "$TUNNEL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['public_url'])")
echo "Tunnel URL: $TUNNEL_URL"

echo "== Restarting Metro with EXPO_PACKAGER_PROXY_URL set =="
pkill -f "expo start" 2>/dev/null || true
sleep 1
(cd "$MOBILE_DIR" && EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL" npx expo start --host localhost) > "$LOG_DIR/expo.log" 2>&1 &
disown
echo -n "Waiting for Metro to come back up"
for _ in $(seq 1 30); do
  if curl -s "http://localhost:8081/status" | grep -q "packager-status:running"; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 1
done

EXP_URL="exp://${TUNNEL_URL#https://}"
echo ""
echo "======================================================"
echo " Open in Expo Go: Enter URL manually ->"
echo " $EXP_URL"
echo "======================================================"

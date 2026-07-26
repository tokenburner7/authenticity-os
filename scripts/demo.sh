#!/usr/bin/env bash
#
# End-to-end demo for authenticity-os.
#
# Starts the full system: registry server, verification API, two networked
# agents that auto-discover and handshake, then exercises the CLI for
# credential attestation, vouching, and verification. Finally hits the
# verification API's HTTP endpoints to show platform-level verification.
#
# Usage:
#   ./scripts/demo.sh          # run the full demo (auto-cleanup)
#   ./scripts/demo.sh --keep   # leave servers running after demo
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ── Config ──────────────────────────────────────────────
REGISTRY_PORT=4000
VERIFICATION_PORT=4001
AGENT1_PORT=3001
AGENT2_PORT=3002
KEEP_RUNNING=false

if [[ "${1:-}" == "--keep" ]]; then
  KEEP_RUNNING=true
fi

# ── Helpers ─────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BLUE}▶${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
step()  { echo -e "\n${BOLD}${BLUE}━━ $* ━━${NC}\n"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*" >&2; }

# PIDs of background processes, for cleanup
PIDS=()

cleanup() {
  if [[ "$KEEP_RUNNING" == true ]]; then
    echo ""
    info "Servers left running. PIDs: ${PIDS[*]}"
    info "Kill them with: kill ${PIDS[*]}"
    return
  fi
  echo ""
  step "Cleaning up"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  ok "All processes stopped"
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local name="$2"
  local tries=30
  while (( tries-- > 0 )); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "$name is up"
      return 0
    fi
    sleep 0.5
  done
  fail "$name did not start at $url"
  exit 1
}

# ── Pre-flight ──────────────────────────────────────────
step "Pre-flight checks"

if ! command -v pnpm &>/dev/null; then
  fail "pnpm not found. Install: npm i -g pnpm"
  exit 1
fi

if [[ ! -d packages/protocol/dist ]]; then
  info "Building packages (first run)..."
  pnpm build
fi

# Clean state for a deterministic demo
rm -rf .auth/demo-*.db
ok "Working directory clean"

# ── 1. Registry Server ──────────────────────────────────
step "Starting registry server (port $REGISTRY_PORT)"

node apps/registry-server/dist/index.js --port=$REGISTRY_PORT &
PIDS+=($!)
wait_for_http "http://localhost:$REGISTRY_PORT/health" "Registry server"

# ── 2. Verification API ─────────────────────────────────
step "Starting verification API (port $VERIFICATION_PORT)"

node apps/verification-api/dist/index.js --port=$VERIFICATION_PORT --db=./.auth/demo-platform.db &
PIDS+=($!)
wait_for_http "http://localhost:$VERIFICATION_PORT/health" "Verification API"

# Show seeded data
echo ""
info "Seeded data in verification API:"
curl -sf "http://localhost:$VERIFICATION_PORT/health" | python3 -m json.tool 2>/dev/null || true

# ── 3. Agent 1 (Alice) ──────────────────────────────────
step "Starting Agent 1: Alice (port $AGENT1_PORT)"

node packages/cli/dist/index.js agent start \
  --name "alice" \
  --port $AGENT1_PORT \
  --registry "http://localhost:$REGISTRY_PORT" \
  --db "./.auth/demo-agent1.db" \
  --bio "Content creator and photographer" &
PIDS+=($!)

# Wait for agent to register
sleep 2
echo ""
info "Agents registered in registry:"
curl -sf "http://localhost:$REGISTRY_PORT/agents" | python3 -m json.tool 2>/dev/null || true

# ── 4. Agent 2 (Bob — discovers Alice) ──────────────────
step "Starting Agent 2: Bob (port $AGENT2_PORT)"
echo "  Bob will auto-discover Alice via the registry and handshake."

node packages/cli/dist/index.js agent start \
  --name "bob" \
  --port $AGENT2_PORT \
  --registry "http://localhost:$REGISTRY_PORT" \
  --db "./.auth/demo-agent2.db" \
  --bio "Musician and writer" &
PIDS+=($!)

# Give agents time to handshake
sleep 3

echo ""
info "Agents in registry after discovery:"
curl -sf "http://localhost:$REGISTRY_PORT/agents" | python3 -m json.tool 2>/dev/null || true

# ── 5. CLI: Attest, Vouch, Verify ───────────────────────
step "CLI demo: attest content, vouch, verify"

# Alice attests content
info "Alice attests content..."
node packages/cli/dist/index.js attest \
  --content "My original photo essay on urban architecture" \
  --ai-assistance partial \
  --db "./.auth/demo-agent1.db"

# Alice exports her credential as W3C VC
echo ""
info "Alice exports her credential as W3C VC..."
node packages/cli/dist/index.js export \
  --index 0 \
  --db "./.auth/demo-agent1.db" \
  > .auth/demo-credential.json
ok "Exported W3C VC to .auth/demo-credential.json"

# Bob vouches for Alice — need alice's public key
ALICE_ID=$(node packages/cli/dist/index.js identity show \
  --db "./.auth/demo-agent1.db" 2>/dev/null | grep -oE '[0-9a-f]{64}' | head -1)

if [[ -n "$ALICE_ID" ]]; then
  echo ""
  info "Bob vouches for Alice (${ALICE_ID:0:16}...)"
  node packages/cli/dist/index.js vouch \
    --target "$ALICE_ID" \
    --evidence "Collaborated on 3 photo essays, verified in person" \
    --db "./.auth/demo-agent2.db"
fi

# Check reputation — use alice's identity id
echo ""
info "Alice's reputation (from agent1 DB):"
node packages/cli/dist/index.js reputation show \
  --identity "$ALICE_ID" \
  --db "./.auth/demo-agent1.db" 2>&1 || warn "No reputation in agent1 DB yet (expected — vouches are in agent2 DB)"

# Bob's reputation for alice from his vouch
if [[ -n "$ALICE_ID" ]]; then
  echo ""
  info "Alice's reputation as seen by Bob (agent2 DB, where the vouch lives):"
  node packages/cli/dist/index.js reputation show \
    --identity "$ALICE_ID" \
    --db "./.auth/demo-agent2.db" 2>&1 || true
fi

# Verify the credential
echo ""
info "Verifying Alice's credential..."
node packages/cli/dist/index.js verify \
  --index 0 \
  --db "./.auth/demo-agent1.db"

# ── 6. Verification API ─────────────────────────────────
step "Platform verification API demo"

info "Health check:"
curl -sf "http://localhost:$VERIFICATION_PORT/health" | python3 -m json.tool

# Verify a seeded credential via the HTTP API.
# The platform DB has a seeded creation credential for alice in raw
# SignedCredential format, which is what the /verify endpoint expects.
echo ""
info "Verifying seeded credential via HTTP API (/verify)..."
cd apps/verification-api && node -e "
import('@auth/protocol').then(p => {
  const s = new p.SqliteStore('../../.auth/demo-platform.db');
  const creds = s.loadAllCredentials();
  const creation = creds.find(c => c.payload.type === 'creation');
  if (creation) {
    const fs = require('fs');
    fs.writeFileSync('../../.auth/demo-verify-body.json', JSON.stringify({credential: creation}));
  }
  s.close();
});
" && cd "$ROOT_DIR"

curl -sf -X POST "http://localhost:$VERIFICATION_PORT/verify" \
  -H "Content-Type: application/json" \
  -d @.auth/demo-verify-body.json | python3 -m json.tool

# Look up seeded reputation for alice from the platform DB
echo ""
info "Reputation lookup for seeded alice (platform DB)::"
PLATFORM_ALICE_ID=$(cd apps/verification-api && node -e "
import('@auth/protocol').then(p => {
  const s = new p.SqliteStore('../../.auth/demo-platform.db');
  const alice = s.loadIdentityByHandle('alice');
  process.stdout.write(alice?.id || '');
  s.close();
});
" && cd "$ROOT_DIR")

if [[ -n "$PLATFORM_ALICE_ID" ]]; then
  curl -sf "http://localhost:$VERIFICATION_PORT/reputation/$PLATFORM_ALICE_ID" | python3 -m json.tool
fi

# ── Summary ─────────────────────────────────────────────
step "Demo complete"
echo "  Registry server:     http://localhost:$REGISTRY_PORT"
echo "  Verification API:    http://localhost:$VERIFICATION_PORT"
echo "  Agent 1 (Alice):     ws://localhost:$AGENT1_PORT"
echo "  Agent 2 (Bob):       ws://localhost:$AGENT2_PORT"
echo ""
echo "  Web apps (run in separate terminals):"
echo "    Demo visualiser:   cd apps/demo && pnpm dev    (port 5173)"
echo "    Brand portal:      cd apps/brand-portal && pnpm dev  (port 5174)"
echo ""
ok "All systems operational"

if [[ "$KEEP_RUNNING" == true ]]; then
  echo ""
  info "Servers running. Press Ctrl+C to stop."
  wait
fi

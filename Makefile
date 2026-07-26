.PHONY: demo web-demo build test lint clean install start-registry start-verification

# Default target
.DEFAULT: help

help:
	@echo "Authenticity OS — Make targets"
	@echo ""
	@echo "  make install     Install dependencies"
	@echo "  make build       Build all packages"
	@echo "  make test        Run all tests"
	@echo "  make lint        Type-check all packages"
	@echo "  make clean       Remove dist + node_modules"
	@echo "  make demo        Run the full end-to-end system demo"
	@echo "  make web-demo    Start the web apps (demo + brand portal)"
	@echo "  make start-registry   Start only the registry server"
	@echo "  make start-verification  Start only the verification API"

install:
	pnpm install

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

clean:
	pnpm clean

demo:
	./scripts/demo.sh

demo-keep:
	./scripts/demo.sh --keep

# Start web apps for manual exploration
web-demo:
	@echo "Starting web apps. Open these in your browser:"
	@echo "  Demo visualiser:   http://localhost:5173"
	@echo "  Brand portal:      http://localhost:5174"
	@echo ""
	@cd apps/demo && pnpm dev &
	@cd apps/brand-portal && pnpm dev

# Individual servers (for development)
start-registry:
	node apps/registry-server/dist/index.js --port=4000

start-verification:
	node apps/verification-api/dist/index.js --port=4001 --db=./.auth/platform.db

start-agent-1:
	node packages/cli/dist/index.js agent start --name alice --port 3001 --registry http://localhost:4000 --db ./.auth/agent1.db

start-agent-2:
	node packages/cli/dist/index.js agent start --name bob --port 3002 --registry http://localhost:4000 --db ./.auth/agent2.db

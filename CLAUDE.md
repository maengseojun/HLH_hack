# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HyperIndex (HI) is an integrated DeFi platform that combines HyperCore blockchain integration with AMM functionality and index token management. This project merges the best components from two previous projects: dev6 (AMM + IndexToken systems) and hlh (HyperCore integration + Docker infrastructure).

## Development Commands

### Docker Development (Recommended)
```bash
# Start development environment
./docker-dev.sh dev

# Check service status
./docker-dev.sh status

# View logs
./docker-dev.sh logs

# Stop all services
./docker-dev.sh stop

# Clean up containers
./docker-dev.sh clean
```

### Workspace Commands
```bash
# Install all dependencies
npm install

# Build all workspaces
npm run build

# Run tests across all workspaces
npm run test

# Lint all workspaces
npm run lint
```

### Frontend (Next.js 15 + pnpm)
```bash
cd frontend

# Development server with Turbo
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Run tests
pnpm test
```

### Backend (Express + TypeScript)
```bash
cd backend

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Production start
npm start

# Run tests
npm test

# Lint and fix
npm run lint:fix
```

### Smart Contracts
```bash
# Compile contracts (if contract tools exist)
npm run contracts:compile

# Test contracts
npm run contracts:test

# Deploy contracts
npm run contracts:deploy
```

## Architecture Overview

### Monorepo Structure
- **Root**: Workspace manager with Docker orchestration
- **frontend/**: Next.js 15 application with Privy auth, Aceternity UI components
- **backend/**: Express API server with Redis caching and HyperCore integration
- **contracts/**: Solidity smart contracts organized by functionality

### Key Architectural Components

#### HyperCore Integration
- `contracts/hypercore/`: Native blockchain integration contracts
- `HyperCoreActions.sol`: Interface to HyperCore's CoreWriter precompile
- `HyperL1Reader.sol`: Reads from HyperCore L1 state
- Backend services handle HyperCore API interactions

#### AMM System (from dev6)
- `contracts/amm/`: Uniswap V2-style AMM implementation
- `HyperIndexFactory.sol`: Pair creation factory
- `HyperIndexPair.sol`: Liquidity pool implementation
- `HyperIndexRouter.sol`: Swap routing logic

#### Index Token System (from dev6)
- `contracts/tokens/`: ERC20 index token management
- `IndexToken.sol`: Upgradeable ERC20 representing index fund shares
- `IndexTokenFactory.sol`: Creates and manages index tokens
- `RedemptionManager.sol`: Handles token redemption and underlying asset management

#### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion
- **Authentication**: Privy for wallet connection and MFA
- **UI Components**: Aceternity UI, Radix UI primitives
- **Backend**: Express.js, TypeScript, Redis for caching
- **Blockchain**: Solidity contracts, OpenZeppelin libraries
- **Infrastructure**: Docker Compose, multi-stage builds

### Environment Configuration
- Uses `.env` file for configuration (copy from `.env.example`)
- Requires Privy app credentials
- Redis configuration for caching
- HyperCore network endpoints

### Development Workflow
1. The project uses Docker for consistent development environment
2. Frontend and backend run as separate services
3. Redis provides caching and session management
4. Smart contracts are organized by functional domain
5. All services are orchestrated through Docker Compose

## Service URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Redis: localhost:6379

## Testing
- Frontend: Jest for component testing
- Backend: Jest for API testing
- Integration tests should be placed in `tests/` directory
- Use `npm run test` to run all workspace tests

## Linting and Type Checking
- ESLint configuration across all workspaces
- TypeScript strict mode enabled
- Run `npm run lint` for workspace-wide linting
- Frontend includes separate `type-check` command
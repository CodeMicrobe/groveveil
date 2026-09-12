# Groveveil — Verified Real-World Tree Planting Platform

> **Architecture Status**: Phase 1 (Foundation) Complete  
> **Mobile Package**: `@groveveil/mobile` (React Native / Expo TypeScript)  
> **Backend Package**: `@groveveil/server` (Node.js / Fastify Modular Monolith)  
> **Database**: SQLite (Local Dev) / PostgreSQL (Target Production) via Prisma ORM  
> **Design Philosophy**: Nature × Premium × Paper

---

## 1. System Architecture

Groveveil is structured with an **untrusted mobile client** and an **authoritative backend modular monolith**:

### Mobile Architecture (`@groveveil/mobile`)
- **Presentation Layer**: Screen coordinators & Botanical Design System (`src/presentation/theme`, `src/presentation/components`).
- **Application / ViewModel Layer**: Zustand stores managing local UI and form draft state (`useAuthStore`, `useTreeDraftStore`).
- **Domain Layer**: Client-side domain contracts and validators matching server schemas (`src/domain/models`).
- **Data Layer**: API client with JWT Bearer injection, secure credential storage, and hardware GPS/camera abstractions (`src/data/`).

### Backend Architecture (`@groveveil/server`)
- **API Layer**: Fastify REST controllers strictly versioned under `/api/v1/` with Zod request validation, correlation IDs (`x-request-id`), rate limiting, and structured logging with PII/secret redaction.
- **Application Services**: Use cases orchestrating domain transitions, event dispatching, and transaction integrity.
- **Domain Layer**: Authoritative entities, invariants, verification state machines, and achievement evaluation engine.
- **Persistence Layer**: Prisma ORM, relational schema with `onDelete: Restrict` audit preservation, spatial indexes, and pre-signed S3 storage gateways.

---

## 2. Environment Configuration

Copy the example environment file into `apps/server/.env`:
```bash
cp apps/server/.env.example apps/server/.env
```

### Environment Variables (`apps/server/.env`):
| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Runtime environment mode | `development` |
| `PORT` | HTTP port for Fastify server | `3000` |
| `HOST` | Network bind interface | `0.0.0.0` |
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` (Dev) / `postgresql://user:pass@host:5432/db` (Prod) |
| `JWT_SECRET` | Secret key for signing authoritative session tokens | *Secret string* |
| `JWT_EXPIRES_IN` | Session token lifetime | `7d` |
| `GOOGLE_CLIENT_ID` | Official Google OAuth 2.0 Client ID | *Google Cloud Console Client ID* |
| `MEDIA_STORAGE_DIR` | Local disk upload staging directory (dev) | `./uploads` |

> [!NOTE]
> `.env` is strictly ignored by `.gitignore`. Never commit production secrets.

---

## 3. Local Setup & Quickstart

### Prerequisites
- **Node.js**: `>= 20.0.0` (Verified on Node.js `v24.14.1`)
- **npm**: `>= 10.0.0`

### Step-by-Step Installation
```bash
# 1. Install all monorepo dependencies
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Apply database migrations (creates SQLite dev.db)
npm run prisma:migrate

# 4. Seed initial botanical species and core achievements
npm run prisma:seed
```

---

## 4. Development Commands

| Command | Action |
|---|---|
| `npm run dev:server` | Starts Fastify backend with hot reload on `http://localhost:3000` |
| `npm run dev:mobile` | Launches Expo Metro bundler for iOS/Android/Web |
| `npm run typecheck` | Typechecks all workspaces (`@groveveil/server` & `@groveveil/mobile`) |
| `npm run build` | Compiles server TypeScript to `dist/` |
| `npm test` | Runs the full backend automated test suite via Vitest |
| `npm run prisma:migrate` | Generates and executes database schema migrations |
| `npm run prisma:seed` | Seeds botanical species catalog and milestone achievement definitions |

---

## 5. Testing & Verification

The test suite validates database integrity, schema migrations, security boundaries, and core business rules:
```bash
npm test
```

### Verified Foundation Test Suites:
- **`tests/health.test.ts`**: Verifies `/api/v1/health` reports status `healthy` and active database connectivity.
- **`tests/database.test.ts`**: Verifies species queries, relational aliases, and engine-level `onDelete: Restrict` preventing raw user deletions.
- **`tests/auth-boundary.test.ts`**: Verifies that unconfigured Google credentials honestly report unconfigured state (503/status) without pretending success, and that protected routes reject unauthorized requests.
- **`tests/authorization.test.ts`**: Verifies the resource ownership guard, blocking horizontal privilege escalation (403 Forbidden).
- **`tests/canonical-friend.test.ts`**: Verifies deterministic friendship ordering (`userAId < userBId`) and self-friendship rejection.
- **`tests/location-privacy.test.ts`**: Verifies coordinate obfuscation reducing GPS precision to protected grid cells.

---

## 6. Continuous Integration (CI)

GitHub Actions workflow is configured in `.github/workflows/ci.yml`:
1. Checks out repository and sets up Node.js.
2. Runs `npm ci` for deterministic dependency resolution.
3. Generates Prisma Client.
4. Executes full workspace typechecking (`npm run typecheck`).
5. Runs test suite (`npm test`).
6. Builds server distribution (`npm run build`).
7. Spawns a PostgreSQL container service and validates production schema compatibility.

---

## 7. Next Phases Roadmap

- **Phase 2**: Tree Reporting & Pre-Signed Media Storage (3-step reporting wizard, GPS telemetry, operator review endpoint).
- **Phase 3**: Server-Authoritative Achievements & Google Play Games Sync Adapter.
- **Phase 4**: Privacy-Preserving Nearby Map & Discovery.
- **Phase 5**: Lightweight Social & Friend Connections.
- **Phase 6**: Environmental Impact Engine (versioned calculation models).
- **Phase 7**: Planting Journal, Settings & Account Deletion Lifecycle.
- **Phase 8**: Production Hardening & E2E Verification Walkthrough.

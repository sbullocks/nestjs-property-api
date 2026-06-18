# NestJS Property API — Full Stack Learning Curriculum

A structured, hands-on curriculum for building a production-style multi-tenant property management system — backend API + React frontend — from scratch. Built and rebuilt multiple times as a deliberate practice exercise modeled after real Full Stack Engineer interview requirements.

---

## What Was Built

A multi-tenant REST API + React frontend where multiple companies share one database but each company's data is fully isolated. Every API route is authenticated via JWT, access is controlled by role-based guards, and the frontend reflects those permissions visually.

**Backend features:** JWT auth · RBAC · multi-tenancy · Prisma ORM · pagination + filtering · config validation · rate limiting · cache invalidation · Swagger/OpenAPI

**Frontend features:** RTK Query data fetching · Redux auth state · protected routes · role-based UI · full CRUD with dialogs · pagination + filtering

---

## Project Structure

```
nestjs-property-api/
├── app/                        ← Round 1 backend (reference implementation)
├── app-v2/                     ← Round 2 backend (rebuilt from scratch)
├── frontend/                   ← React frontend (connects to either backend)
├── modules/                    ← Concept reference modules (16 topics)
├── exercises/                  ← Phase-by-phase exercise guides
├── rebuild-checklist.md        ← Backend rebuild checklist (all 6 phases)
├── frontend-rebuild-checklist.md ← Frontend rebuild checklist (all 5 phases)
├── frontend-guide.md           ← Frontend concept guide (detailed)
├── my-notes.md                 ← Running notes built throughout the curriculum
├── crib-sheet.md               ← Interview-ready quick reference
├── cheatsheet.md               ← Pure syntax lookup
├── data-model.md               ← ERD diagrams (Mermaid) for both schemas
├── advanced-checklist.md       ← Expanded 8-model PropertyCo-style schema guide
└── troubleshooting.md          ← Known errors and fixes
```

---

## How to Run

**Backend (app-v2):**
```bash
cd app-v2
npm install
npm run start:dev        # starts on http://localhost:3000
# Swagger UI at http://localhost:3000/api
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev              # starts on http://localhost:5173
```

Make sure both servers are running. The frontend hits `http://localhost:3000` by default.

---

## Backend Tech Stack

| Layer | Tool |
|---|---|
| Framework | NestJS |
| ORM | Prisma v6 |
| Database | PostgreSQL 16 |
| Language | TypeScript |
| Auth | JWT + Passport.js |
| Validation | class-validator + class-transformer |
| Docs | Swagger/OpenAPI |
| Config | @nestjs/config + Joi |
| Rate limiting | @nestjs/throttler |
| Caching | @nestjs/cache-manager + cache-manager v7 |

## Frontend Tech Stack

| Layer | Tool |
|---|---|
| Build tool | Vite |
| UI framework | React 18 |
| Language | TypeScript |
| State | Redux Toolkit |
| Data fetching | RTK Query |
| UI components | MUI v5 |
| Routing | React Router v7 |

---

## Backend Phases

| Phase | Focus | Key Concepts |
|---|---|---|
| 1 | Scaffold + Prisma + Guards | DI, PrismaService, ApiKeyGuard, LoggingInterceptor, multi-tenancy |
| 2 | JWT Auth + RBAC + Swagger | JwtStrategy, JwtAuthGuard, RolesGuard, Reflector, @CurrentUser |
| 3 | Validation + Full CRUD | ValidationPipe, class-validator, DTOs, NotFoundException, findFirst |
| 4 | Pagination + Filtering | QueryDto, dynamic where, Promise.all, skip/take, EXPLAIN ANALYZE |
| 5 | Testing | Jest, mocking Prisma, e2e tests, Reflect.defineMetadata |
| 6 | Config + Rate Limiting + Caching | ConfigModule, Joi, ThrottlerModule, CacheModule, cache invalidation |

## Frontend Phases

| Phase | Focus | Key Concepts |
|---|---|---|
| 1 | Scaffold + Store + Router | Vite, Redux store, RTK Query base API, MUI, React Router |
| 2 | Auth + Token + Protected Routes | authSlice, localStorage, useLoginMutation, ProtectedRoute |
| 3 | Properties List | useGetPropertiesQuery, providesTags, pagination, filtering |
| 4 | CRUD | mutations, invalidatesTags, Dialog, PropertyForm |
| 5 | Role-Based UI | role from useAuth, conditional rendering, RBAC on frontend |

---

## Key Architecture Decisions

**Multi-tenancy:** Row-level isolation via `tenantId` on every `Property` row. Every query filters by `tenantId` from the verified JWT — never from the request body. A tenant can never see another tenant's data.

**Auth flow:** Login returns a signed JWT containing `{ sub, tenantId, role }`. `JwtAuthGuard` verifies the token on every protected request. `RolesGuard` reads the required roles via `Reflector` and compares against `request.user.role`. Guard order matters — JWT must run before Roles.

**Cache invalidation:** `CacheInterceptor` was intentionally disabled on tenant-scoped routes because it keys by URL only — two tenants hitting `GET /properties` would share a cached response (data leakage). Manual `cacheManager.clear()` after every write is the safe alternative.

**Frontend state:** RTK Query manages server state (properties list, CRUD). Redux manages client state (auth token, role, tenantId). `providesTags`/`invalidatesTags` keep the list automatically in sync after mutations — no manual refetch.

---

## Reference Files

- `rebuild-checklist.md` — primary tool for rebuilding the backend from scratch
- `frontend-rebuild-checklist.md` — primary tool for rebuilding the frontend from scratch
- `my-notes.md` — deep concept notes built across all phases
- `crib-sheet.md` — concise interview-ready summary
- `data-model.md` — ERD diagrams for current and expanded schemas
- `cheatsheet.md` — pure syntax lookup
- `troubleshooting.md` — known errors and fixes

---

## Prerequisites

```bash
node --version           # 20+
brew install postgresql@16
sudo npm i -g @nestjs/cli
createdb hpos_v2_db      # create the database before running migrations
```

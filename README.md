# NestJS Property API — Learning Curriculum

A structured curriculum for building a multi-tenant property management API using NestJS, Prisma, PostgreSQL, and TypeScript. Modeled after hands-on guided training with a build-it-yourself practice project.

---

## How to Use This

1. Read the module for the concept you're about to build
2. Check the cheatsheet when you need a quick syntax reference
3. Follow the exercise to build it yourself
4. If something breaks, check troubleshooting

Do not read modules top to bottom like a book. Read the relevant section, then go build.

---

## Modules

| # | Module | What You'll Learn |
|---|---|---|
| 1 | [NestJS Fundamentals](./modules/01-nestjs-fundamentals.md) | Modules, DI, controllers, services, bootstrap |
| 2 | [Prisma + PostgreSQL](./modules/02-prisma.md) | Schema, migrations, Prisma Client, queries |
| 3 | [Guards + Interceptors](./modules/03-guards-interceptors.md) | Auth guards, logging interceptors, request pipeline |
| 4 | [Multi-Tenancy](./modules/04-multi-tenancy.md) | Row-level isolation, tenantId, relations |
| 5 | [Query Optimization](./modules/05-query-optimization.md) | N+1, include vs select, indexes, EXPLAIN ANALYZE |
| 6 | [TypeScript Depth](./modules/06-typescript-depth.md) | Generics, utility types, decorators, enums |
| 7 | [JWT Authentication](./modules/07-jwt-auth.md) | JWT flow, Passport, JwtStrategy, JwtAuthGuard |
| 8 | [RBAC](./modules/08-rbac.md) | Roles, custom decorators, RolesGuard, Reflector |
| 9 | [OpenAPI / Swagger](./modules/09-openapi.md) | Auto-generated API docs, @ApiProperty, Swagger UI |
| 10 | [Validation](./modules/10-validation.md) | class-validator, ValidationPipe, DTO decorators, whitelist |
| 11 | [Error Handling](./modules/11-error-handling.md) | NotFoundException, HttpException, tenant-safe deletes |
| 12 | [Pagination & Filtering](./modules/12-pagination-filtering.md) | skip/take, dynamic where, Promise.all, N+1, EXPLAIN ANALYZE |
| 13 | [Testing](./modules/13-testing.md) | Jest, unit tests, mocking, e2e tests, coverage |

---

## Exercises

| Phase | Exercise | Difficulty | Focus |
|---|---|---|---|
| 1 | [Phase 1 Build](./exercises/phase-1.md) | 3/5 | Scaffold → Prisma → guards → interceptors → multi-tenancy |
| 2 | [Phase 2 Build](./exercises/phase-2.md) | 4/5 | JWT auth → RBAC → OpenAPI |
| 3 | [Phase 3 Build](./exercises/phase-3.md) | 3/5 | Validation → complete CRUD → error handling |
| 4 | [Phase 4 Build](./exercises/phase-4.md) | 4/5 | Pagination → filtering → query optimization |
| 5 | [Phase 5 Build](./exercises/phase-5.md) | 4/5 | Unit tests → mocking → e2e tests → coverage |

---

## Reference

- [Cheatsheet](./cheatsheet.md) — pure syntax lookup, no prose
- [Troubleshooting](./troubleshooting.md) — known errors and fixes

---

## Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS |
| ORM | Prisma v5 |
| Database | PostgreSQL 16 (local via Homebrew) |
| Language | TypeScript |

---

## Prerequisites

```bash
node --version        # need 20+
brew install postgresql@16
sudo npm i -g @nestjs/cli
```

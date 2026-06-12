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

---

## Exercises

| Phase | Exercise | Focus |
|---|---|---|
| 1 | [Phase 1 Build](./exercises/phase-1.md) | Full end-to-end: scaffold → Prisma → guards → interceptors → multi-tenancy |

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

# Module 2: Prisma + PostgreSQL

Prisma is an ORM — it lets you interact with your database using TypeScript instead of raw SQL. Think of it as a typed query builder that generates a client from your schema.

---

## 2.1 What Prisma Is

| Raw SQL / pg                           | Prisma                                |
| -------------------------------------- | ------------------------------------- |
| `db.query('SELECT * FROM properties')` | `prisma.property.findMany()`          |
| Manual type casting                    | Types generated from your schema      |
| Schema lives in SQL files              | Schema lives in `schema.prisma`       |
| Migrations written by hand             | Migrations generated from schema diff |

Prisma has two parts:

| Package          | Role                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| `prisma` (CLI)   | Dev tool — manages schema, migrations, code generation. Not shipped to production. |
| `@prisma/client` | Runtime client — what your app imports and calls. Shipped to production.           |

> **Install (always use v5 with NestJS — see Troubleshooting):**

```bash
npm install prisma@5 @prisma/client@5
npx prisma init
```

> **Docs:** https://www.prisma.io/docs/orm/prisma-schema

---

## 2.2 Files Created by `prisma init`

- `prisma/schema.prisma` — source of truth for your data model. Define all tables here as Prisma models.
- `.env` — stores `DATABASE_URL`. Never commit this file.

---

## 2.3 DATABASE_URL

The connection string Prisma uses to reach your Postgres database.

```
postgresql://USER@HOST:PORT/DATABASE
```

For local Homebrew install on Mac:

```
DATABASE_URL="postgresql://your_mac_username@localhost:5432/hpos_test_db"
```

| Part                | Meaning                                         |
| ------------------- | ----------------------------------------------- |
| `postgresql://`     | protocol                                        |
| `your_mac_username` | Postgres user (Mac username for local Homebrew) |
| `localhost`         | host                                            |
| `5432`              | default Postgres port                           |
| `hpos_test_db`      | database name                                   |

---

## 2.4 Schema — Defining Models

Models in `schema.prisma` map directly to database tables.

```prisma
model Property {
  id        Int      @id @default(autoincrement())
  name      String
  address   String
  city      String
  state     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Field syntax:

| Prisma                      | SQL equivalent      | Notes                                          |
| --------------------------- | ------------------- | ---------------------------------------------- |
| `String`                    | `TEXT` or `VARCHAR` | Required by default (NOT NULL)                 |
| `String?`                   | `TEXT` (nullable)   | `?` makes a field optional                     |
| `Int`                       | `INTEGER`           |                                                |
| `DateTime`                  | `TIMESTAMP`         |                                                |
| `@id`                       | `PRIMARY KEY`       |                                                |
| `@default(autoincrement())` | `SERIAL`            |                                                |
| `@default(now())`           | `DEFAULT NOW()`     |                                                |
| `@updatedAt`                | —                   | Prisma sets this automatically on every update |

Fields are **required by default** — you do not write `NOT NULL`. That is SQL syntax. In Prisma, if you want a nullable field, add `?`.

---

## 2.5 Migrations

A migration records a schema change as SQL and applies it to the database.

```bash
npx prisma migrate dev --name init
```

What happens:

1. Prisma diffs your current schema against migration history
2. Generates SQL and saves it to `prisma/migrations/<timestamp>_init/migration.sql`
3. Applies the SQL to your database
4. Records the migration in the `_prisma_migrations` table
5. Regenerates Prisma Client so TypeScript types stay in sync

| Command                 | Use                | Behavior                                                                        |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `prisma migrate dev`    | Development        | Diffs schema, generates SQL, applies, regenerates client. Can prompt and reset. |
| `prisma migrate deploy` | Production / CI/CD | Applies pending migrations only. No generation, no prompts, no resets.          |

Generated SQL for common schema changes:

| Schema change | Generated SQL             |
| ------------- | ------------------------- |
| New model     | `CREATE TABLE`            |
| Add field     | `ALTER TABLE ADD COLUMN`  |
| Remove field  | `ALTER TABLE DROP COLUMN` |
| Add index     | `CREATE INDEX`            |

---

## 2.6 Prisma Client — Common Queries

After any schema change, regenerate the client:

```bash
npx prisma generate
```

**findMany — get all records:**

```ts
const properties = await prisma.property.findMany()
```

**findMany with filter:**

```ts
const properties = await prisma.property.findMany({
  where: { tenantId: 1 },
})
```

**findUnique — get one by primary key:**

```ts
const property = await prisma.property.findUnique({
  where: { id: 1 },
})
```

**create:**

```ts
const property = await prisma.property.create({
  data: {
    name: 'Sunset Apartments',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
  },
})
```

**update:**

```ts
const property = await prisma.property.update({
  where: { id: 1 },
  data: { name: 'New Name' },
})
```

**delete:**

```ts
await prisma.property.delete({
  where: { id: 1 },
})
```

> **Docs:** https://www.prisma.io/docs/orm/reference/prisma-client-reference

---

## 2.7 Wiring Prisma into NestJS

Prisma Client does not manage its own connection lifecycle in NestJS. You wrap it in a NestJS service that handles connect/disconnect via lifecycle hooks.

**PrismaService** (`src/prisma/prisma.service.ts`):

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

**Why extend PrismaClient instead of instantiating it?**
Extending makes `PrismaService` the client — you call `this.property.findMany()` directly. If you held an instance (`private client = new PrismaClient()`), every call would be `this.client.property.findMany()` and you'd manage the instance yourself.

**PrismaModule** (`src/prisma/prisma.module.ts`):

```ts
import { Module, Global } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` makes `PrismaService` available to every module without explicit imports. Appropriate for database access — it's needed everywhere.

**In AppModule** — import the module, never add PrismaService directly to providers:

```ts
@Module({
  imports: [PrismaModule, PropertiesModule],
})
export class AppModule {}
```

> Adding `PrismaService` to both `PrismaModule.exports` and `AppModule.providers` creates two separate instances. Only import the module.

---

## 2.8 Postgres Local Setup (Homebrew)

```bash
brew install postgresql@16
pg_ctl -D /opt/homebrew/var/postgresql@16 start
createdb hpos_test_db
```

Connect in terminal:

```bash
psql hpos_test_db
```

Useful psql commands:

```sql
\l            -- list databases
\c hpos_test_db   -- connect to database
\dt           -- list tables
\d "Property" -- describe a table
\q            -- quit
```

TablePlus connection:

- Host: `127.0.0.1` | Port: `5432` | User: your Mac username | Password: blank | Database: `hpos_test_db`

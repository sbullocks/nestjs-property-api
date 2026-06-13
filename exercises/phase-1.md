# Phase 1: Build the API From Scratch

Work through each step in order. Read the relevant module section before each step if you need context. Come back to the cheatsheet for syntax.

The goal at the end: a running NestJS API with Prisma + PostgreSQL, API key auth, request logging, and multi-tenant data isolation.

---

## Step 1: Scaffold the project

> Run these commands from your Desktop — NOT from inside the curriculum notes folder.

```bash
cd ~/Desktop
nest new property-api
cd property-api
npm run start:dev
```

Visit `http://localhost:3000` — you should see "Hello World!".

Read these four files before moving on:
- `src/main.ts`
- `src/app.module.ts`
- `src/app.controller.ts`
- `src/app.service.ts`

**Understand:** What is `AppModule` doing? What is `NestFactory.create()` doing? Where is the "Hello World!" string coming from?

**Commit:**
```bash
git add .
git commit -m "feat: scaffold NestJS project"
```

---

## Step 2: Generate the Properties resource

```bash
nest generate resource properties
# Choose: REST API → yes to CRUD entry points
```

Start the app and confirm the routes are registered — you'll see them in the terminal output.

**Understand:** What files were generated? What was added to `app.module.ts`? What is a DTO?

**Commit:**
```bash
git add .
git commit -m "feat: generate properties resource"
```

---

## Step 3: Set up PostgreSQL

```bash
pg_ctl -D /opt/homebrew/var/postgresql@16 start
createdb hpos_dev
```

Verify in TablePlus:
- Host: `127.0.0.1` | Port: `5432` | User: your Mac username | Password: blank | Database: `hpos_dev`

---

## Step 4: Install and init Prisma

```bash
npm install prisma@5 @prisma/client@5
npx prisma init
```

Update `.env`:
```
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/hpos_dev"
```

**Understand:** What two files did `prisma init` create? What does `DATABASE_URL` connect to?

---

## Step 5: Define the Property model

Open `prisma/schema.prisma` and add the Property model:

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

Run the migration:
```bash
npx prisma migrate dev --name init
```

Verify in TablePlus — you should see a `Property` table.

**Commit:**
```bash
git add .
git commit -m "feat: add Property model and initial migration"
```

---

## Step 6: Wire Prisma into NestJS

Generate the service and module:
```bash
nest generate service prisma
nest generate module prisma
```

Write `src/prisma/prisma.service.ts` — extends PrismaClient, implements OnModuleInit and OnModuleDestroy. See the cheatsheet for the pattern.

Write `src/prisma/prisma.module.ts` — global module, exports PrismaService. See the cheatsheet.

Add `PrismaModule` to `AppModule.imports[]`. Do NOT add PrismaService to `AppModule.providers[]`.

**Understand:** Why extend PrismaClient instead of instantiating it? Why @Global()?

**Commit:**
```bash
git add .
git commit -m "feat: add PrismaService and PrismaModule"
```

---

## Step 7: Use PrismaService in PropertiesService

Inject `PrismaService` via the constructor in `src/properties/properties.service.ts`.

Implement `findAll` to return all properties from the database:
```ts
async findAll(): Promise<Property[]> {
  return this.prisma.property.findMany();
}
```

Import `Property` from `@prisma/client`.

Start the app and test:
```bash
curl http://localhost:3000/properties
# Expected: []
```

**Commit:**
```bash
git add .
git commit -m "feat: wire PrismaService into PropertiesService"
```

---

## Step 8: Add API key guard

Create `src/common/guards/api-key.guard.ts`. Implement `CanActivate`. Read `x-api-key` from request headers. Return true if it matches. Throw `UnauthorizedException` if not.

Apply `@UseGuards(ApiKeyGuard)` above the `@Controller` decorator in `properties.controller.ts`. Pass the class — not `new ApiKeyGuard()`.

Test:
```bash
# Should return 401
curl http://localhost:3000/properties

# Should return []
curl -H "x-api-key: secret" http://localhost:3000/properties
```

**Commit:**
```bash
git add .
git commit -m "feat: add ApiKeyGuard to properties controller"
```

---

## Step 9: Add logging interceptor

Create `src/common/interceptors/logging.interceptor.ts`. Implement `NestInterceptor`. Extract `method` and `url` from `ExecutionContext`. Log incoming request before handler. Use `tap` to log duration after handler.

Apply globally in `main.ts` with `app.useGlobalInterceptors(new LoggingInterceptor())`.

Test — hit any endpoint and watch the terminal:
```
[GET] /properties — incoming
[GET] /properties — 4ms
```

**Commit:**
```bash
git add .
git commit -m "feat: add LoggingInterceptor globally"
```

---

## Step 10: Add multi-tenant isolation

Update `prisma/schema.prisma` — add Tenant model and `tenantId` to Property. See Module 4 for the full schema.

Run the migration:
```bash
npx prisma migrate dev --name add-tenant
```

Update `PropertiesService.findAll` to accept and filter by `tenantId`:
```ts
async findAll(tenantId: number): Promise<Property[]> {
  return this.prisma.property.findMany({
    where: { tenantId },
  });
}
```

Update the controller to pass `tenantId` (hardcode `1` for now):
```ts
@Get()
findAll() {
  return this.propertiesService.findAll(1);
}
```

**Commit:**
```bash
git add .
git commit -m "feat: add multi-tenant isolation with tenantId"
```

---

## Step 11: Add index and verify with EXPLAIN ANALYZE

Add `@@index([tenantId])` to the Property model in schema.prisma.

Run the migration:
```bash
npx prisma migrate dev --name add-tenant-index
```

Open `psql hpos_dev` and run:
```sql
EXPLAIN ANALYZE SELECT * FROM "Property" WHERE "tenantId" = 1;
```

Look for `Index Scan` in the output.

**Commit:**
```bash
git add .
git commit -m "perf: add index on tenantId"
```

---

## Phase 1 Complete

You've built:
- NestJS project with a full CRUD resource
- Prisma v5 wired into NestJS with proper lifecycle management
- PostgreSQL database with migrations
- API key guard protecting all property routes
- Logging interceptor showing method, URL, and duration on every request
- Multi-tenant row-level isolation with tenantId
- Index on tenantId with EXPLAIN ANALYZE verification

**Repeat this phase from scratch using only the cheatsheet** — no modules, no exercises. When you can do that, you're ready for Phase 2.

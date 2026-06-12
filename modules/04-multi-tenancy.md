# Module 4: Multi-Tenancy

Multi-tenancy means multiple customers (tenants) share the same application and database. For a property management platform, each tenant is a property management company. Their data must never be visible to other tenants.

---

## 4.1 Three Isolation Strategies

| Strategy | How | Tradeoffs |
|---|---|---|
| Row-level (shared tables) | `tenantId` column on every table | Simplest, most cost-effective, requires strict query discipline |
| Schema-per-tenant | Separate Postgres schema per tenant | Strong isolation, harder migrations |
| Database-per-tenant | Separate database per tenant | Strongest isolation, most expensive, complex ops |

**This project uses row-level isolation.** This is what most SaaS platforms use at early scale — Shopify, Stripe, and others all started here.

The rule: **every table that holds tenant data gets a `tenantId` column, and every query must filter by it.**

---

## 4.2 Adding the Tenant Model

Add both models to `schema.prisma`:

```prisma
model Tenant {
  id         Int        @id @default(autoincrement())
  name       String
  createdAt  DateTime   @default(now())
  properties Property[]
}

model Property {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  address   String
  city      String
  state     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Then run the migration:
```bash
npx prisma migrate dev --name add-tenant
```

---

## 4.3 Understanding Relations

```prisma
tenant    Tenant   @relation(fields: [tenantId], references: [id])
```

This tells Prisma:
- `tenantId` on `Property` is a foreign key
- It references `id` on `Tenant`
- Prisma enforces referential integrity — you cannot create a `Property` with a `tenantId` that doesn't exist in the `Tenant` table

```prisma
properties Property[]
```

This is the **other side** of the relation on the `Tenant` model. It allows:
```ts
prisma.tenant.findUnique({
  where: { id: 1 },
  include: { properties: true }, // fetches all related properties
});
```

Relations in Prisma are always defined on **both sides**. One side holds the foreign key (`@relation`), the other side holds the back-reference (the array field).

---

## 4.4 Filtering by tenantId in Queries

Every query against a tenant-scoped table must include `tenantId` in the `where` clause:

```ts
// WRONG — returns all properties from all tenants
async findAll(): Promise<Property[]> {
  return this.prisma.property.findMany();
}

// CORRECT — scoped to a specific tenant
async findAll(tenantId: number): Promise<Property[]> {
  return this.prisma.property.findMany({
    where: { tenantId },
  });
}
```

The controller passes `tenantId` from the request. In Phase 1 you hardcode it. In Phase 2 it comes from the JWT:

```ts
@Get()
findAll() {
  return this.propertiesService.findAll(1); // Phase 2: extract from JWT
}
```

**The most common multi-tenant bug:** a query that forgets `tenantId`. It returns data from every tenant. Add `tenantId` to every query as a habit, not an afterthought.

---

## 4.5 Why Row-Level Isolation Requires Discipline

Row-level isolation puts the responsibility on the application layer. The database will not reject a query that forgets `tenantId` — it will just return all rows. There is no automatic enforcement at the database level (unlike schema-per-tenant or database-per-tenant).

This is a trade-off:
- **Benefit:** Simple setup, cheap to operate, easy to migrate all tenants at once
- **Risk:** One missed `where: { tenantId }` leaks data

In production, you'd add this check at a middleware or guard layer so tenantId is always present before reaching the service. That's what Phase 2 (JWT auth) addresses.

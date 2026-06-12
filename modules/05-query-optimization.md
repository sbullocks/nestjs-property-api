# Module 5: Query Optimization

Query optimization is the discipline of making database queries fast and efficient. Three things to know for this stack: N+1, `include` vs `select`, and index strategy.

---

## 5.1 The N+1 Problem

N+1 happens when you fetch a list of records and then run a separate query for each one to get related data. It looks harmless in development with 5 rows. It destroys performance in production with 10,000.

**N+1 — the bad pattern:**
```ts
// 1 query — get all properties
const properties = await prisma.property.findMany();

// N queries — one per property to get its tenant
for (const property of properties) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: property.tenantId },
  });
}
```

100 properties = 101 queries. 10,000 properties = 10,001 queries.

**Fix — use `include` to JOIN in one query:**
```ts
const properties = await prisma.property.findMany({
  include: { tenant: true }, // fetches properties + tenant in one query
});
```

1 query regardless of result count.

---

## 5.2 include vs select

Both control what data Prisma returns. They solve different problems.

**`include`** — fetches a related model alongside the main model:
```ts
prisma.property.findMany({
  include: { tenant: true }, // adds the full tenant object to each property
});
```

**`select`** — returns only specific fields, not the full record:
```ts
prisma.property.findMany({
  where: { tenantId: 1 },
  select: {
    id: true,
    name: true,
    city: true,
    state: true,
    // createdAt, updatedAt, address not included
  },
});
```

**You can combine them:**
```ts
prisma.property.findMany({
  where: { tenantId: 1 },
  select: {
    id: true,
    name: true,
    tenant: {
      select: { name: true }, // only the tenant name, not the full tenant object
    },
  },
});
```

**When to use which:**

| | Use when |
|---|---|
| `include` | You need the full related record |
| `select` | You need only specific fields — reduces payload size and query cost |

Never use `findMany()` with no filters and no `select` in a production endpoint. You'll fetch every column of every row.

> **Docs:** https://www.prisma.io/docs/orm/reference/prisma-client-reference#select

---

## 5.3 Index Strategy

An index is a data structure that lets Postgres find rows without scanning the entire table. Without an index on `tenantId`, every `WHERE tenantId = 1` query scans every row in the table — a full table scan.

**Add an index in schema.prisma:**
```prisma
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

  @@index([tenantId])
}
```

`@@index([tenantId])` tells Prisma to generate `CREATE INDEX ON "Property"("tenantId")`. Run a migration to apply it.

**When to add an index:**
- Columns used in `WHERE` clauses — especially foreign keys like `tenantId`
- Columns used in `ORDER BY`
- Columns used in `JOIN` conditions

**When NOT to add an index:**
- Every write (INSERT/UPDATE/DELETE) must also update the index — too many indexes slow writes
- Low-cardinality columns (e.g., a boolean `isActive`) — not enough distinct values for an index to help

> **Docs:** https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes

---

## 5.4 EXPLAIN ANALYZE

`EXPLAIN ANALYZE` shows you what Postgres is actually doing for a query — whether it's using an index or doing a full table scan.

Run in the psql shell:
```sql
EXPLAIN ANALYZE SELECT * FROM "Property" WHERE "tenantId" = 1;
```

What to look for:

| Output | Meaning |
|---|---|
| `Seq Scan` | Full table scan — slow at scale, consider an index |
| `Index Scan` | Using an index — fast |
| `Bitmap Index Scan` | Using an index for larger result sets — still fast |

Run this **before** adding an index, then **after**. You'll see `Seq Scan` become `Index Scan`.

> **Docs:** https://www.postgresql.org/docs/current/sql-explain.html

---

## 5.5 Query Optimization Checklist

Before shipping any database query to production, ask:

1. Does this query have a `where` clause? (Never return unbounded result sets)
2. Am I selecting only the fields I need? (Use `select` to trim the payload)
3. Am I fetching related data in a loop? (Use `include` instead)
4. Is there an index on every column in my `where` and `order by`?
5. Have I run `EXPLAIN ANALYZE` to confirm the query plan?

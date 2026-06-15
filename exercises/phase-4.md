# Phase 4: Pagination, Filtering & Query Optimization

Starting point: Phase 3 complete — full CRUD working with JWT auth, RBAC, validation, and proper error handling.

Goal: Make `GET /properties` production-ready. Add pagination so large datasets don't crash the API, filtering so clients can find specific properties, and understand the N+1 problem and how Prisma's `include` solves it.

Difficulty: 4/5

---

## Step 1: Create QueryPropertyDto

Create `src/properties/dto/query-property.dto.ts`. This DTO will hold all the optional query parameters:

- `page` — which page (default 1, minimum 1)
- `limit` — results per page (default 10, minimum 1)
- `city` — filter by city (optional)
- `state` — filter by state (optional)
- `search` — partial name search (optional)

Use `@IsOptional()` on every field. Use `@Type(() => Number)` from `class-transformer` on `page` and `limit` — query params always arrive as strings, this coerces them to numbers so `@IsInt()` passes.

See Module 12 for the full pattern.

**Understand:** Why is `@Type(() => Number)` needed here but not on DTO body fields?

---

## Step 2: Update findAll() in the service

Replace the current `findAll(tenantId)` signature with `findAll(tenantId, query: QueryPropertyDto)`.

Build the where clause dynamically:

```ts
const where: Prisma.PropertyWhereInput = { tenantId };
if (query.city) where.city = query.city;
if (query.state) where.state = query.state;
if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
```

Add `skip` and `take` for pagination:
```ts
const page = query.page ?? 1;
const limit = query.limit ?? 10;
const skip = (page - 1) * limit;
```

Run the data query and count query simultaneously with `Promise.all`. Return an object with `data` and `meta`.

Import `Prisma` from `@prisma/client` for the `Prisma.PropertyWhereInput` type.

---

## Step 3: Update findAll() in the controller

Update the `findAll` route to extract query params with `@Query()`:

```ts
@Get()
findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryPropertyDto) {
  return this.propertiesService.findAll(user.tenantId, query);
}
```

Add `Query` to the imports from `@nestjs/common`.

---

## Step 4: Test pagination

Start the server and insert a few properties first:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}' | jq -r '.access_token')

# Create 3 properties
curl -s -X POST http://localhost:3000/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sunset Apartments", "address": "123 Main St", "city": "Austin", "state": "TX"}'

curl -s -X POST http://localhost:3000/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "River Walk", "address": "456 River Rd", "city": "Austin", "state": "TX"}'

curl -s -X POST http://localhost:3000/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hill Country Homes", "address": "789 Hill Dr", "city": "San Antonio", "state": "TX"}'
```

Test pagination:
```bash
# Page 1, 2 results per page
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/properties?page=1&limit=2"

# Page 2
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/properties?page=2&limit=2"
```

Expected: `meta.total` = 3, `meta.totalPages` = 2, each page returns the right slice.

---

## Step 5: Test filtering

```bash
# Filter by city
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/properties?city=Austin"

# Filter by state (all properties)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/properties?state=TX"

# Search by partial name
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/properties?search=hill"
```

Expected: city filter returns only Austin properties. Search for "hill" returns "Hill Country Homes" (case-insensitive).

**Commit:**
```bash
git add .
git commit -m "feat: add pagination, filtering, and search to GET /properties"
```

---

## Step 6: Understand the N+1 Problem

Add `include: { tenant: true }` to `findAll` temporarily:

```ts
prisma.property.findMany({
  where,
  skip,
  take: limit,
  include: { tenant: true },
});
```

Watch the terminal — you'll see one query per property for the tenant instead of a single joined query. That's the N+1 problem. With `include` in Prisma it's actually handled as a single query — but understand why joining data naively in a loop causes N+1.

Remove the `include` after testing — you don't need tenant data on this endpoint.

**Understand:** When would you use `include`? When would you use `select` instead?

---

## Step 7: Run EXPLAIN ANALYZE on the filtered query

Connect to the database:
```bash
psql hpos_test_db
```

Run the query with the execution plan:
```sql
EXPLAIN ANALYZE SELECT * FROM "Property" WHERE "tenantId" = 1 AND city = 'Austin';
```

Look for `Index Scan` vs `Seq Scan`. The `tenantId` index from Phase 1 should be used. Adding a filter on `city` might cause a sequential scan — that's a signal to add an index if city filtering is common.

Add an index for city if you want to test it:
```sql
CREATE INDEX "Property_city_idx" ON "Property"(city);
```

Then run EXPLAIN ANALYZE again — see the plan change.

**Commit:**
```bash
git add .
git commit -m "chore: analyze query performance for pagination and filtering"
```

---

## Phase 4 Complete

You've added:
- Pagination with `skip`/`take` and metadata (`total`, `page`, `limit`, `totalPages`)
- Dynamic filtering by `city`, `state`, and partial `name` search
- `Promise.all` for parallel data + count queries
- `Prisma.PropertyWhereInput` for type-safe dynamic where clauses
- N+1 awareness and how `include` avoids it
- EXPLAIN ANALYZE to verify index usage on filtered queries

**Practice:** Add an `orderBy` query param that lets the client sort by `name`, `city`, or `createdAt`. Allow `asc` or `desc` direction. This is a natural extension of what you built.

# Module 12: Pagination, Filtering & Sorting

A `GET /properties` endpoint that returns every row in the database is fine with 10 properties. With 10,000 it's a performance problem — slow queries, huge responses, and a bad experience for any client. Pagination, filtering, and sorting are standard features of any production REST API.

---

## 12.1 Query Params with a DTO

Query parameters (`?page=1&limit=10&city=Austin`) arrive on the URL. NestJS extracts them with `@Query()`. Define a DTO to type and validate them:

```ts
// src/properties/dto/query-property.dto.ts
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPropertyDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)   // query params arrive as strings — this coerces to number
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Sunset' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

`@Type(() => Number)` is from `class-transformer` — it tells the transformer to coerce the string `"1"` to the number `1`. Required for numeric query params because everything on the URL is a string.

`@IsOptional()` means if the field isn't present, skip validation entirely. This is how you handle optional filters.

---

## 12.2 Pagination in Prisma

Prisma uses `skip` and `take` for pagination:

```ts
// page 1, limit 10 → skip 0, take 10
// page 2, limit 10 → skip 10, take 10
// page 3, limit 10 → skip 20, take 10

const skip = (page - 1) * limit;

prisma.property.findMany({
  where: { tenantId },
  skip,
  take: limit,
});
```

`skip` = how many records to skip (offset). `take` = how many to return (page size).

---

## 12.3 Filtering with Dynamic Where Clauses

Build the `where` clause dynamically based on which filters were provided:

```ts
const where: Prisma.PropertyWhereInput = { tenantId };

if (city) where.city = city;
if (state) where.state = state;
if (search) {
  where.name = { contains: search, mode: 'insensitive' };
}

prisma.property.findMany({ where, skip, take: limit });
```

`Prisma.PropertyWhereInput` is the TypeScript type for the `where` object — gives you autocompletion and type safety when building dynamic filters.

`contains` + `mode: 'insensitive'` does a case-insensitive partial match — searching `"sun"` finds `"Sunset Apartments"`.

---

## 12.4 Sorting

```ts
prisma.property.findMany({
  where,
  orderBy: { createdAt: 'desc' },  // newest first
});
```

Multiple sort fields:
```ts
orderBy: [
  { state: 'asc' },
  { city: 'asc' },
  { name: 'asc' },
]
```

---

## 12.5 Pagination Response with Metadata

Instead of returning just the array, return metadata alongside it so the client knows how many pages exist:

```ts
const [data, total] = await Promise.all([
  this.prisma.property.findMany({ where, skip, take: limit }),
  this.prisma.property.count({ where }),
]);

return {
  data,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  },
};
```

`Promise.all` runs both queries simultaneously instead of sequentially. The `count` query returns the total number of matching rows — needed so the client can calculate total pages.

---

## 12.6 N+1 Problem

The N+1 problem happens when you load a list and then make a separate query for each item.

```ts
// N+1 — 1 query to get properties, then 1 query per property to get the tenant
const properties = await prisma.property.findMany({ where: { tenantId } });
for (const p of properties) {
  const tenant = await prisma.tenant.findUnique({ where: { id: p.tenantId } });
}
// 10 properties = 11 queries. 100 properties = 101 queries. Scales terribly.
```

Fix with `include` — Prisma joins the data in one query:
```ts
const properties = await prisma.property.findMany({
  where: { tenantId },
  include: { tenant: true },  // 1 query total, tenant data included
});
```

Only use `include` when you actually need the related data. If you only need property fields, don't include the tenant — unnecessary data transfer.

> **Docs:** https://www.prisma.io/docs/orm/prisma-client/queries/pagination

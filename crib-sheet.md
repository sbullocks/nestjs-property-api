# NestJS Property API — Crib Sheet

Quick-reference for interviews, whiteboarding, and "walk me through it" moments.
Not a build guide — use rebuild-checklist.md for that.

---

## What I Built

A multi-tenant property management REST API. Multiple companies (tenants) share one
database but each company can only see their own data. Authentication is JWT-based with
role-based access control (RBAC).

**Tech:** NestJS · Prisma · PostgreSQL · JWT/Passport · Swagger · ConfigModule · Throttler · CacheModule

---

## The Data Model

```
Tenant (1) ──── (many) Property
```

Every Property row has a `tenantId` FK. Every query filters by `tenantId` so companies
never see each other's data.

---

## Auth Flow — End to End

```
POST /auth/login { tenantId, role }
  → AuthService.login() signs JWT payload: { sub, tenantId, role }
  → client stores token, sends as: Authorization: Bearer <token>
  → JwtAuthGuard extracts + verifies token (via JwtStrategy)
  → JwtStrategy.validate() returns payload → attached to request.user
  → @CurrentUser() reads request.user → user.tenantId flows into service
  → service queries: prisma.property.findMany({ where: { tenantId } })
```

**Key rule:** `tenantId` always comes from the verified JWT. Never trust the request body.

---

## RBAC Flow

```
@Roles(Role.Admin) on route
  → SetMetadata(ROLES_KEY, [Role.Admin]) writes a "sticky note" on the handler

Request hits RolesGuard (runs after JwtAuthGuard):
  → Reflector.getAllAndOverride(ROLES_KEY, [handler, class]) reads the note
  → if no note → return true (open to all authenticated users)
  → requiredRoles.some(role => user.role === role) → true = allow, false = 403
```

**Guard order matters:** `@UseGuards(JwtAuthGuard, RolesGuard)` — JWT runs first,
populates `request.user`, then RolesGuard reads `user.role`.

---

## Key Patterns

### Tenant-scoped query
```ts
findMany({ where: { tenantId } })           // findAll
findFirst({ where: { id, tenantId } })      // findOne — both id AND tenantId
```

### Ownership check before mutation
```ts
const property = await prisma.property.findFirst({ where: { id, tenantId } });
if (!property) throw new NotFoundException(`Property ${id} not found`);
// proceed with update/delete
```
Returns 404 for both "doesn't exist" and "belongs to another tenant" — caller can't
tell which, so they can't fish for other tenants' record IDs.

### Pagination + filtering
```ts
const where: Prisma.PropertyWhereInput = { tenantId };
if (query.city) where.city = query.city;
if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
const page = query.page ?? 1;
const skip = (page - 1) * limit;
const [data, total] = await Promise.all([
  prisma.property.findMany({ where, skip, take: limit }),
  prisma.property.count({ where }),
]);
return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
```

### Cache invalidation on writes
```ts
const result = await prisma.property.create({ data: { ...dto, tenantId } });
await this.cacheManager.clear();
return result;
```
Order: DB write → clear cache → return. Never clear before write (would clear on failure).

---

## Module Wiring (AppModule)

```ts
ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({...}) })
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
CacheModule.register({ isGlobal: true, ttl: 30000, max: 100 })
// providers:
{ provide: APP_GUARD, useClass: ThrottlerGuard }  // global rate limiting
```

## AuthModule Wiring

```ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: '7d' },
  }),
})
```
Use `registerAsync` not `register` — DI isn't ready when `register()` runs synchronously.
Use `getOrThrow` not `get` — returns `string` not `string | undefined`, avoids TypeScript squiggles.

---

## NestJS Concepts Used

| Concept | What it does | Where used |
|---|---|---|
| Module | Groups related providers | Every feature folder |
| Controller | Receives HTTP request, delegates | PropertiesController, AuthController |
| Service | Business logic + DB queries | PropertiesService, AuthService |
| Guard | Allow/deny a request | JwtAuthGuard, RolesGuard |
| Interceptor | Wrap request/response lifecycle | LoggingInterceptor |
| Pipe | Transform/validate input | ValidationPipe (global) |
| Decorator | Attach metadata or extract data | @Roles(), @CurrentUser(), @ApiTags() |
| DI | Inject services via constructor | Throughout |

---

## Key Gotchas

| Mistake | Fix |
|---|---|
| `SetMetadata('ROLES_KEY', roles)` | Must be `SetMetadata(ROLES_KEY, roles)` — constant not string |
| `import { JwtPayload }` in decorated file | Must be `import type { JwtPayload }` |
| Semicolon after `@UseGuards(...)` | Remove it |
| `JwtModule.register()` with ConfigService | Use `registerAsync()` |
| `configService.get()` for required value | Use `configService.getOrThrow()` |
| `CacheInterceptor` on tenant-scoped routes | URL-only cache key leaks data across tenants |
| `cacheManager.reset()` | Renamed to `clear()` in cache-manager v5+ |
| FK error on property create | Tenant row must exist first |
| Query param not converting to number | Add `@Type(() => Number)` — query params arrive as strings |
| Controller passes wrong arg count to service | TypeScript squiggle = missing `user.tenantId` |
| `findUnique` for tenant-scoped lookup | Use `findFirst` — `findUnique` can't filter on non-unique columns |

---

## How to Answer "Walk Me Through It"

> "I built a multi-tenant REST API in NestJS with Prisma and PostgreSQL.
> Authentication is JWT-based using Passport.js — login returns a signed token carrying
> the tenant ID and role, and a custom JwtAuthGuard validates that token on every
> protected route. Role-based access control is implemented via a custom @Roles()
> decorator that uses NestJS's SetMetadata to attach required roles to route handlers,
> and a RolesGuard that reads those requirements via the Reflector and compares against
> the authenticated user's role.
>
> Multi-tenancy is enforced at the query level — every Prisma query includes the tenantId
> from the JWT payload in the where clause, so companies never see each other's data even
> though they share one database. I also implemented pagination and filtering on list
> endpoints using a QueryDto with class-validator decorators, running the data fetch and
> total count queries in parallel with Promise.all. For production readiness I added
> ConfigModule with Joi schema validation so the app refuses to start if required env vars
> are missing, global rate limiting via ThrottlerModule, and CacheModule with manual
> cache invalidation on every write operation."

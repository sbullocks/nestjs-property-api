# Rebuild Checklist

Use this to rebuild the app from scratch. Each item is one action. When you get stuck, go to my-notes.md — the why is always there.

---

## Phase 1 — Scaffold, Prisma, Guards, Multi-Tenancy

- [x] `nest new app` → `cd app` → `npm run start:dev` — confirm Hello World at localhost:3000
- [x] `npm install prisma@"^6.0.0" @prisma/client@"^6.0.0"`
- [x] `npx prisma init` — fix generator to `prisma-client-js`, delete `prisma.config.ts` if generated
- [x] Add `DATABASE_URL` to `.env`
- [x] Define `Tenant` and `[Resource]` models in `schema.prisma` — Resource gets `tenantId Int` + `@relation`
- [x] `npx prisma migrate dev --name init`
- [x] `nest generate module prisma` → `nest generate service prisma`
- [x] Write `PrismaService` — extends `PrismaClient`, implements `OnModuleInit` / `OnModuleDestroy`
- [x] Add `@Global()` to `PrismaModule`, add `PrismaService` to `providers` and `exports`
- [x] `nest generate resource [resources]` — REST API, generate CRUD entry points yes
- [x] Inject `PrismaService` into `[Resource]Service` constructor
- [x] Replace `findAll` stub — `prisma.[resource].findMany({ where: { tenantId } })`, hardcode `tenantId: 1` for now
- [x] Create `ApiKeyGuard` — `implements CanActivate`, checks `request.headers['x-api-key']` .. this means to create the common/guards folder in the src directory with file api-key.guard.ts.
- [x] Update the `.env` file with `API_KEY` and value as `secret` (hardcoded for now)
- [x] Run the following terminal commands with the server started:
      `curl http://localhost:3000/properties` - should return `{"message": "Unauthorized", "statusCode": 401}`
      `curl -H "x-api-key: secret" http://localhost:3000/properties` - should return the empty [] of properties
- \*\* [troubleshooting] \*\* if error occurs on starting the server, might need to run `npx prisma generate`
- [x] Apply `@UseGuards(ApiKeyGuard)` to resource controller
- [x] Create `LoggingInterceptor` — `implements NestInterceptor`, log method/url before, duration after via `tap()` .. this means to create the `interceptors` folder inside the `common` directory and create file `logging.interceptor.ts`.
- [x] `app.useGlobalInterceptors(new LoggingInterceptor())` in `main.ts`
- [x] Test: `curl -H "x-api-key: secret" http://localhost:3000/[resources]` returns empty array `[]`
- [x] Insert a Tenant + Property row in psql, confirm list returns it, change hardcoded tenantId to 2, confirm `[]`
  - From the app directory run `psql <your-db-name>` — db name is in `.env` → `DATABASE_URL` value
  - Insert a Tenant: `INSERT INTO "Tenant" (name) VALUES ('Test Tenant');`
  - Insert a Property (`updatedAt` has no SQL default — must be provided manually):
    `INSERT INTO "Property" ("tenantId", name, address, city, state, "updatedAt") VALUES (1, 'Sunset Villas', '123 Main St', 'Austin', 'TX', NOW());`
  - Enter `\q` to quit psql
  - Run `curl -H "x-api-key: secret" http://localhost:3000/properties` → should return the property
  - Change hardcoded `tenantId: 1` to `tenantId: 2` in `properties.service.ts` `findAll`
  - Hit the endpoint again → `[]` (Tenant 2 exists but has no properties)
  - Revert hardcode back to `1` before moving to Phase 2

---

## Phase 2 — JWT Auth, RBAC, Swagger

- [ ] `npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger`
- [ ] `npm install --save-dev @types/passport-jwt`
- [ ] Add `JWT_SECRET=your-super-secret-key-change-in-production` to `.env`
- [ ] Create `src/common/enums/role.enum.ts` — `Admin`, `TenantUser`, `Viewer`
- [ ] Create `src/auth/interfaces/jwt-payload.interface.ts` — `{ sub, tenantId, role }`
- [ ] `nest generate module auth` → `nest generate service auth` → `nest generate controller auth`
- [ ] Create `src/auth/dto/login.dto.ts` — `@ApiProperty` + `@IsNumber` on tenantId, `@IsString @IsNotEmpty @IsEnum(Role)` on role
- [ ] Write `AuthService.login()` — signs JWT with `{ sub: tenantId, tenantId, role }`
- [ ] Write `AuthController` — `POST /auth/login` using `LoginDto`, `@ApiTags('auth')`
- [ ] Create `src/auth/jwt.strategy.ts` — extends `PassportStrategy(Strategy)`, `process.env.JWT_SECRET!`, `validate()` returns payload
- [ ] Create `src/common/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`
- [ ] Create `src/common/decorators/roles.decorator.ts` — export `ROLES_KEY = 'roles'`, `@Roles()` uses `SetMetadata(ROLES_KEY, roles)` — **NOT the string `'ROLES_KEY'`**
- [ ] Create `src/common/guards/roles.guard.ts` — inject `Reflector`, `getAllAndOverride(ROLES_KEY, [...])`, `requiredRoles.some()`
- [ ] Create `src/common/decorators/current-user.decorator.ts` — `createParamDecorator`, returns `request.user`
- [ ] Update `AuthModule` — import `PassportModule` + `JwtModule.register()`, providers `[AuthService, JwtStrategy]`
- [ ] Apply `@UseGuards(JwtAuthGuard, RolesGuard)` to resource controller — remove `ApiKeyGuard`
- [ ] Add `@Roles(Role.Admin)` to delete route
- [ ] Update all service methods to accept `tenantId` parameter — replace hardcoded value
- [ ] Update all controller methods to use `@CurrentUser() user: JwtPayload` — use `import type { JwtPayload }`
- [ ] Swagger: `DocumentBuilder` in `main.ts` before `app.listen()`, `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` on controller
- [ ] Test: login → copy token → Authorize in Swagger → GET → 200, DELETE with viewer token → 403, no token → 401

---

## Phase 3 — Validation, Complete CRUD, Error Handling

- [ ] `npm install class-validator class-transformer`
- [ ] `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `main.ts`
- [ ] Add `@ApiProperty` + `@IsString` + `@IsNotEmpty` to all `CreateDto` fields, `@Length(2,2)` on any state/code fields
- [ ] Add `@IsNumber` + `@IsEnum(Role)` to `LoginDto`
- [ ] Replace `create()` stub — `prisma.[resource].create({ data: { ...dto, tenantId } })` — **tenantId from JWT, never body**
- [ ] Replace `findOne()` stub — `findFirst({ where: { id, tenantId } })` → `NotFoundException` if null
- [ ] Replace `update()` stub — `findFirst` → `NotFoundException` → `prisma.[resource].update({ where: { id }, data: dto })`
- [ ] Replace `remove()` stub — `findFirst` → `NotFoundException` → `prisma.[resource].delete({ where: { id } })`
- [ ] Verify all controller methods pass `user.tenantId` — TypeScript squiggle = argument count mismatch
- [ ] Ensure Tenant row exists in DB before testing create (FK constraint)
- [ ] Test: empty body → 400, valid body → 201, wrong tenantId record → 404, viewer delete → 403

---

## Phase 4 — Pagination, Filtering, Query Optimization

- [ ] Create `query-[resource].dto.ts` — `@IsOptional @Type(() => Number) @IsInt` on `page`/`limit`, `@IsOptional @IsString` on filter fields
- [ ] Update `findAll` service — build `Prisma.[Resource]WhereInput` dynamically, add filters with `if` checks
- [ ] Calculate `skip = (page - 1) * limit`
- [ ] `Promise.all([findMany({ where, skip, take: limit }), count({ where })])` — parallel queries
- [ ] Return `{ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }`
- [ ] Update controller `findAll` — add `@Query() query: QueryDto`
- [ ] Test: `?page=1&limit=2`, `?city=Austin`, `?search=sunset` — confirm filtering and pagination work
- [ ] In psql: `EXPLAIN ANALYZE SELECT * FROM "[Resource]" WHERE "tenantId" = 1 AND city = 'Austin';`
- [ ] Add index: `CREATE INDEX "[Resource]_city_idx" ON "[Resource]"(city);` — re-run EXPLAIN ANALYZE

---

## Phase 5 — Testing

- [ ] Add `moduleNameMapper: { "^src/(.*)$": "<rootDir>/$1" }` to jest config in `package.json`
- [ ] Create `.env.test` — separate `DATABASE_URL` (different db name) + `JWT_SECRET=test-secret-for-e2e`
- [ ] `createdb [appname]_e2e` in terminal
- [ ] `DATABASE_URL=[test url] npx prisma migrate deploy`
- [ ] Create `test/setup-env.ts` — `dotenv.config({ path: resolve(__dirname, '../.env.test') })`
- [ ] Create `test/jest-e2e.json` — `setupFiles`, `moduleNameMapper`, `rootDir: "."`
- [ ] Write `[resource].service.spec.ts` — `mockPrismaService`, test all CRUD methods + `NotFoundException` cases
- [ ] Write `auth.service.spec.ts` — mock `JwtService` with `mockReturnValue`, verify payload shape
- [ ] Write `roles.guard.spec.ts` — `createMockContext` with `Reflect.defineMetadata`, test allow/deny/no-roles cases
- [ ] Write `auth.controller.spec.ts` — mock `AuthService`, verify delegation
- [ ] Write `[resource].controller.spec.ts` — mock service, verify all methods delegate with `user.tenantId`
- [ ] Write `test/app.e2e-spec.ts` — `beforeAll` boot app, seed tenant + get tokens, test full CRUD + role enforcement
- [ ] `npm test` → `npm run test:cov` → `npm run test:e2e`

---

## Phase 6 — ConfigModule, Rate Limiting, Caching

- [ ] `npm install @nestjs/config joi @nestjs/throttler @nestjs/cache-manager cache-manager`
- [ ] `ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({...}) })` in `AppModule`
- [ ] Test startup validation: remove `JWT_SECRET` from `.env` → app should refuse to start
- [ ] Update `JwtStrategy` — inject `ConfigService`, use `configService.get<string>('JWT_SECRET')`
- [ ] Update `JwtModule` — switch from `register()` to `registerAsync({ imports, inject, useFactory })`
- [ ] `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` in `AppModule` imports
- [ ] `{ provide: APP_GUARD, useClass: ThrottlerGuard }` in `AppModule` providers
- [ ] Add `@Throttle({ default: { ttl: 60000, limit: 5 } })` to `POST /auth/login`
- [ ] Test 429: hit login 7 times in a loop, expect 5x 201 then 2x 429
- [ ] `CacheModule.register({ isGlobal: true, ttl: 30000, max: 100 })` in `AppModule` imports
- [ ] Inject `@Inject(CACHE_MANAGER) private cacheManager: Cache` into resource service
- [ ] Call `await this.cacheManager.clear()` after `create`, `update`, and `remove`
- [ ] **DO NOT** add `@UseInterceptors(CacheInterceptor)` to tenant-scoped routes — URL-only cache key leaks data across tenants
- [ ] Add `getHealth()` to `AppService` — returns `{ status: 'ok', timestamp: new Date().toISOString() }`
- [ ] Add `@SkipThrottle() @Get('health') getHealth()` to `AppController`
- [ ] Test multi-tenancy: insert second tenant in psql, get TOKEN1 + TOKEN2, confirm each only sees their own data

---

## Gotchas to Remember

| Mistake                                       | Fix                                                           |
| --------------------------------------------- | ------------------------------------------------------------- |
| `SetMetadata('ROLES_KEY', roles)`             | Must be `SetMetadata(ROLES_KEY, roles)` — constant not string |
| `import { JwtPayload }` in decorated file     | Must be `import type { JwtPayload }`                          |
| Semicolon after decorator `@UseGuards(...);`  | Remove the semicolon                                          |
| Swagger sends empty body                      | Use a DTO class with `@ApiProperty()`, not inline type        |
| `Property 'reset' does not exist`             | Use `cacheManager.clear()` — renamed in cache-manager v5+     |
| `@CacheInterceptor` on tenant-scoped routes   | Disabled — cache key is URL only, leaks data across tenants   |
| `JwtModule.register()` with ConfigService     | Use `registerAsync()` — `register()` runs before DI is ready  |
| FK constraint on resource create              | Tenant row must exist first — insert one in psql              |
| Unit tests: `Cannot find module 'src/...'`    | Add `moduleNameMapper` to jest config in `package.json`       |
| Controller calls service with wrong arg count | TypeScript squiggle = you forgot to add `user.tenantId`       |

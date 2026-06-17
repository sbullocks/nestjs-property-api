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

- [x] `npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger`
- [x] `npm install --save-dev @types/passport-jwt`
- [x] Add `JWT_SECRET=your-super-secret-key-change-in-production` to `.env`
- [x] Create `src/common/enums/role.enum.ts` — `Admin`, `TenantUser`, `Viewer`
- [x] Create `src/auth/interfaces/jwt-payload.interface.ts` — `{ sub, tenantId, role }`
- [x] `nest generate module auth` → `nest generate service auth` → `nest generate controller auth`
- [x] Create `src/auth/dto/login.dto.ts` — `@ApiProperty` + `@IsNumber` on tenantId, `@IsString @IsNotEmpty @IsEnum(Role)` on role .. this means you need to manaully create the `dto` folder under the `auth` directory and create the file `login.dto.ts`. Just note that if you dont install the `class-validator` now, it won't work which is okay bc not using it yet.
  - **EACH field needs its OWN `@ApiProperty` directly above it.** `tenantId` → `@ApiProperty({ example: 1 })` (a NUMBER); `role` → `@ApiProperty({ example: 'admin' })` (a string)
  - Common mistake: putting one `@ApiProperty({ example: 'admin' })` above `tenantId` and none on `role` → Swagger shows `{ "tenantId": "admin" }` with no role field. The decorator describes the property directly below it
  - `@ApiProperty` only controls the Swagger example/docs — it does NOT validate. You can still send a wrong body manually until Phase 3 wires up `ValidationPipe`
- [x] Write `AuthService.login()` — signs JWT with `{ sub: tenantId, tenantId, role }` .. make sure to import `import { JwtService } from '@nestjs/jwt';` to define in the constructor.
- [x] Write `AuthController` — `POST /auth/login` using `LoginDto`, `@ApiTags('auth')` .. this means I need to import in the `LoginDto` component.. add the constructor using AuthService. The login Body expects to follow the LoginDto model.
- [x] Create `src/auth/jwt.strategy.ts` — extends `PassportStrategy(Strategy)`, `process.env.JWT_SECRET!`, `validate()` returns payload .. grabbed the example from `https://docs.nestjs.com/recipes/passport#implementing-passport-strategies` as there is an example in their `auth/jwt.strategy.ts` file.
- [x] Create `src/common/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')` .. grabbed the exampole from `https://docs.nestjs.com/recipes/passport#jwt-functionality` as there is an example in their `uth/jwt-auth.guard.ts` file.
- [x] Create `src/common/decorators/roles.decorator.ts` — export `ROLES_KEY = 'roles'`, `@Roles()` uses `SetMetadata(ROLES_KEY, roles)` — **NOT the string `'ROLES_KEY'`**
- [x] Create `src/common/guards/roles.guard.ts` — inject `Reflector`, `getAllAndOverride(ROLES_KEY, [...])`, `requiredRoles.some()`
  - Every guard = class `implements CanActivate` with one `canActivate()` returning `true` (allow) / `false` (deny → Nest sends 403)
  - Inject `Reflector` — it's the ONLY tool that reads the metadata the `@Roles()` decorator wrote
  - `getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()])` — reads the sticky note; checks the method first, falls back to the controller. Import `ROLES_KEY` from the decorator file — same key both sides or it silently fails
  - `if (!requiredRoles) return true;` — route has no `@Roles()` → no restriction → allow. Without this line, unrestricted routes crash on the next line
  - Get the user: `const user = context.switchToHttp().getRequest().user;` — `JwtAuthGuard` ran FIRST and put the verified payload on `request.user`. That ordering is why this guard can assume the user exists
  - `return requiredRoles.some((role) => user.role === role);` — true if the user's role matches any allowed role
  - **Key mental model:** `@Roles()` writes the note, `RolesGuard` reads it. Guard order in `@UseGuards(JwtAuthGuard, RolesGuard)` matters — auth must populate `request.user` before roles can be checked
  - This file does NOT change in any later phase — Phase 2 version = final version
- [x] Create `src/common/decorators/current-user.decorator.ts` — `createParamDecorator`, returns `request.user`
- [x] Update `AuthModule` — import `PassportModule` + `JwtModule.register()`, providers `[AuthService, JwtStrategy]`
  - **This goes in `src/auth/auth.module.ts` — NOT `app.module.ts`.** AuthModule owns its own JWT/Passport deps; AppModule just imports AuthModule
  - **Use `JwtModule.register()` (synchronous) in Phase 2** — reads `process.env.JWT_SECRET` directly. The `registerAsync()` + `ConfigService` version is a Phase 6 upgrade (don't use it now — ConfigModule doesn't exist yet)
  - `register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } })`
  - Without this wiring, the app throws `Nest can't resolve dependencies of AuthService` — because `AuthService` injects `JwtService`, which only exists once `JwtModule` is registered here
- [x] Apply `@UseGuards(JwtAuthGuard, RolesGuard)` to resource controller — remove `ApiKeyGuard`
- [x] Add `@Roles(Role.Admin)` to delete route
- [x] Update all service methods to accept `tenantId` parameter — replace hardcoded value .. this means in the service file just update the signatures to include the param of `tenantId: number`.. keep in mind that the order I declare them in is the same order I must pass the arguments to the caller!
  - **ALL FIVE methods need it — easy to miss one.** Target signatures: `create(dto, tenantId)`, `findAll(tenantId)`, `findOne(id, tenantId)`, `update(id, dto, tenantId)`, `remove(id, tenantId)`
  - Only `findAll` had a hardcoded value to replace (`{ tenantId: 1 }` → `{ tenantId }`). The others (create/findOne/update/remove) are still stub bodies — just add the param to the signature, leave the stub body until Phase 3
  - If the controller errors "2 arguments but service declares 1," that's a service signature you forgot to update
- [x] Update all controller methods to use `@CurrentUser() user: JwtPayload` — use `import type { JwtPayload }`
  - Add `@CurrentUser() user: JwtPayload` as a parameter to EVERY method
  - Import as `import type { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';` — `type` is required because it's an interface (a type, not a runtime value) used in a decorated file
  - Also import `{ CurrentUser }` (no `type`) from the decorator file
  - **The decorator alone does nothing** — must actually PASS `user.tenantId` into each service call (e.g. `findAll(user.tenantId)`, `create(dto, user.tenantId)`). Remove all hardcoded values like `findAll(1)`
  - Controller param ORDER doesn't matter (Nest injects by decorator). But the service CALL arguments are positional — must match the service signature order
  - If the service requires `tenantId` and you forget to pass it, TypeScript errors "Expected 2 arguments, got 1" — that red squiggle is your safety net
- [ ] Swagger: `DocumentBuilder` in `main.ts` before `app.listen()`, `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` on controller
  - **This step edits TWO places: `main.ts` AND every controller. Easy to do one and forget the other.**
  - **main.ts:** `DocumentBuilder` with `.setTitle()`, `.setDescription()`, `.setVersion()`, and `.addBearerAuth()` → `.build()`, then `SwaggerModule.setup('api', app, document)` before `app.listen()`
    - `.addBearerAuth()` is REQUIRED — it creates the "Authorize" button in Swagger UI so you can paste your JWT. Without it you can't test protected routes
  - **Class-level decorators** (above `@Controller`): `@ApiTags('name')` groups routes in the UI; `@ApiBearerAuth()` shows the padlock / marks routes as needing a token
  - **Method-level decorators** (directly above each `@Get`/`@Post`/etc): `@ApiOperation({ summary: '...' })` + `@ApiResponse({ status, description })` — describe THAT route. Summary text must match the route (don't copy/paste "login" text onto a property route)
  - **CRITICAL: `@ApiBearerAuth()` goes ONLY on protected controllers.** PropertiesController = yes (every route needs a token). AuthController = NO — `/auth/login` is public (it's how you GET the token; you don't have one yet)
  - `.addBearerAuth()` in main.ts + `@ApiBearerAuth()` on the controller are a PAIR — both required for the Authorize button to actually work
  - `@ApiOperation`/`@ApiResponse` are documentation polish — the API works without them, but add them per-route for a clean UI
  - Cleanup: remove the now-unused `ApiKeyGuard` import from the controller
- [x] Test: login → copy token → Authorize in Swagger → GET → 200, DELETE with viewer token → 403, no token → 401
  - Login body: `{ "tenantId": 1, "role": "viewer" }` — **`tenantId` is a NUMBER (1), `role` is the string.** Don't put "viewer" in the tenantId field
  - If you put a string in `tenantId`, you get a 500 PrismaClientValidationError (`Expected Int, provided String`) when GET runs `findMany({ where: { tenantId: "viewer" } })` — because there's no validation yet (Phase 3 catches this with a 400)
  - Copy `access_token` from the login response → click **Authorize** → paste → confirm
  - `GET /properties` with viewer token → 200 + your tenant 1 property
  - `DELETE /properties/:id` with viewer token → 403 (only Admin can delete)
  - Log in again with `role: "admin"` → re-authorize → DELETE works
  - No token → 401

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

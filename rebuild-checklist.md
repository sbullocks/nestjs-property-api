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
- [x] Swagger: `DocumentBuilder` in `main.ts` before `app.listen()`, `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` on controller
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

- [x] `npm install class-validator class-transformer` .. note: might have already installed above to avoid errors in the files where I imported them. no harm to run again.
- [x] `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `main.ts` .. NestJS docs regarding built-in ValidationPipe. This page reviews the different settings that can be configured into the configuration object passed to the pipe..
      example: whitelist, transform, forbidNonWhitelisted..
  - ⚠️ HEADS UP: testing forbidNonWhitelisted will NOT work yet at this step! The next step (adding @IsString/@IsNotEmpty decorators to CreatePropertyDto) is what makes it work. Don't panic if you test early and ALL fields get rejected.
  - WHY: `whitelist` only treats a field as "valid" if it has a class-validator decorator. Right now the DTO is an empty stub (`export class CreatePropertyDto {}`), so EVERY field (name, address, etc.) is seen as unknown.
    - forbidNonWhitelisted: false → strips all fields → empty {} → stub returns 201 (looks like nothing validated, because nothing did)
    - forbidNonWhitelisted: true → rejects all fields → 400 listing every field as "should not exist"
  - To test PROPERLY: first populate CreatePropertyDto with decorated fields (next step), THEN send a POST /properties with an extra junk field like "hackerField" → it should 400 with only "property hackerField should not exist"
- [x] Add `@ApiProperty` + `@IsString` + `@IsNotEmpty` to all `CreateDto` fields, `@Length(2,2)` on any state/code fields
  - **Reference `schema.prisma` to know which fields belong in the DTO** — it's the source of truth for what columns exist
  - Rule: schema fields MINUS auto-generated (`id`, `createdAt`, `updatedAt`) MINUS server-derived (`tenantId` from JWT, relation fields like `tenant Tenant`) = DTO fields
  - For `CreatePropertyDto`: `name`, `address`, `city`, `state` — those are the only four fields the client actually sends
  - Fields are called **properties** (not params) — same as TypeScript class properties
  - `@Length(2,2)` on `state` — enforces exactly 2 characters (e.g. "TX", "CA")
- [x] Add `@IsNumber` + `@IsEnum(Role)` to `LoginDto` .. NOTE: might of already completed this in Phase 2. If so, move on.
- [x] Replace `create()` stub — `prisma.[resource].create({ data: { ...dto, tenantId } })` — **tenantId from JWT, never body**
- [x] Replace `findOne()` stub — `findFirst({ where: { id, tenantId } })` → `NotFoundException` if null
  - Must be `async` + `await` the Prisma call — without `await`, you get a Promise (always truthy), null check never triggers
  - `throw` before `return` — check first, return only if it passed
  - Pattern: `const x = await prisma.x.findFirst({ where: { id, tenantId } })` → `if (!x) throw new NotFoundException(...)` → `return x`
- [x] Replace `update()` stub — `findFirst` → `NotFoundException` → `prisma.[resource].update({ where: { id }, data: dto })`
  - Same async/await + null check pattern as findOne, then mutate: `prisma.[resource].update({ where: { id }, data: dto })`
- [x] Replace `remove()` stub — `findFirst` → `NotFoundException` → `prisma.[resource].delete({ where: { id } })`
  - Same async/await + null check pattern as findOne, then mutate: `prisma.[resource].delete({ where: { id } })`
  - **NestJS method → Prisma method mapping (reference for all stubs above):**
    - `findAll` → `findMany` — returns multiple rows
    - `findOne` → `findFirst` (**NOT `findUnique`**) — `findUnique` only works on `@unique` fields (just `id`). `findFirst` lets you filter on BOTH `id` AND `tenantId` — that's the ownership security check. `findUnique({ where: { id, tenantId } })` throws a TypeScript error
    - `create` → `create` — spread DTO + attach tenantId: `{ data: { ...dto, tenantId } }`
    - `update` → `findFirst` first → then `update` — verify ownership before mutating
    - `remove` → `findFirst` first → then `delete` — verify ownership before deleting
  - **The ownership pattern for update/remove:** `findFirst({ where: { id, tenantId } })` → if null throw `NotFoundException` → then mutate. Tenant 2 can't update/delete tenant 1's records — both cases return 404 (not 403), so the attacker can't even confirm the record exists
- [x] Verify all controller methods pass `user.tenantId` — TypeScript squiggle = argument count mismatch .. NOTE: completed in Phase 2.. just verifying tenantId is being passed from the JwtPayload and not the user providing it.
- [x] Ensure Tenant row exists in DB before testing create (FK constraint)
  - Verify in Prisma Studio (`npx prisma studio`) or psql that a Tenant row exists before hitting `POST /properties`
  - If no Tenant row exists and you try to create a Property, Postgres throws a FK constraint error — the Property's `tenantId` must reference a real Tenant row
  - You CAN get a JWT token for a non-existent `tenantId` (login doesn't verify the tenant exists — known shortcut in this design). But `POST /properties` will fail with a FK error if no matching Tenant row exists. `GET /properties` just returns `[]`
  - In a real app with email/password auth, this gap doesn't exist — you can only get a token for a user that already exists in the DB, and their `tenantId` comes from their DB record
  - Confirm multi-tenancy works: log in as tenant 2, `GET /properties` → `[]` (can only see your own data)
- [x] Test: empty body → 400, valid body → 201, wrong tenantId record → 404, viewer delete → 403
  - curl requires `Authorization: Bearer <token>` — the word `Bearer` + a space is required. Without it you get 401
  - If GET returns `[]` unexpectedly and code looks right, add `console.log('tenantId:', tenantId)` in the service to confirm the correct value is arriving before assuming a code bug
  - **[troubleshooting] If data looks wrong — check your DB connection first.** TablePlus/Prisma Studio may be pointed at a different database (e.g. `hpos_test_db` instead of `hpos_v2_db`). Always verify the connection string matches your `.env` `DATABASE_URL` before debugging code
  - To test "wrong tenantId → 404": log in as tenant 2, hit `GET /properties/<id-that-belongs-to-tenant-1>` → expect 404. Tenant 2 can't see tenant 1's record even if they know the exact id
  - FK error on `POST /properties`: means the Tenant row for that `tenantId` doesn't exist yet — insert the Tenant row in psql first

---

## Phase 4 — Pagination, Filtering, Query Optimization

- [x] Create `query-[resource].dto.ts` — `@IsOptional @Type(() => Number) @IsInt` on `page`/`limit`, `@IsOptional @IsString` on filter fields
  - Manually create this file — no CLI command generates it
  - **Where fields come from:** `page`/`limit` = standard REST pagination (always include on list endpoints); filter fields = schema columns worth searching by cross-referenced with `CreateDto` (if it can be created with a value, it can likely be searched by it)
  - `@IsOptional` on every field — query params are never required
  - `@Type(() => Number)` on `page`/`limit` — query params always arrive as strings from the URL (`?page=1`). Tells class-transformer to convert them to numbers. Requires `transform: true` in `ValidationPipe` (already set in `main.ts`)
  - `@IsInt` on `page`/`limit` — validates after the type conversion that it's a whole number
  - Filter fields (`city`, `state`, `search`) use `@IsOptional @IsString` only — they stay as strings
  - Reference `app/src/properties/dto/query-property.dto.ts` for the exact shape if needed
- [x] Update `findAll` service — build `Prisma.[Resource]WhereInput` dynamically, add filters with `if` checks
  - Add `query: QueryPropertyDto` as a second param to `findAll` — service AND controller must both be updated
  - **Remove the explicit return type** (`Promise<Property[]>`) — you're returning `{ data, meta }` not a plain array. Let TypeScript infer it
  - Start `where` with `{ tenantId }` then add filters conditionally — only add if the value was sent:
    `if (query.city) where.city = query.city;`
    `if (query.search) where.name = { contains: query.search, mode: 'insensitive' };`
  - **Common mistake:** building the dynamic `where` object but passing `{ tenantId }` directly to `findMany` instead of `where` — silently ignores all filter work
- [x] Calculate `skip = (page - 1) * limit`
  - `page ?? 1` and `limit ?? 10` — default values if not sent in request
  - `skip` = records to jump over. Page 1 → skip 0, Page 2 → skip 10, Page 3 → skip 20
  - `take` = how many to return (same value as `limit`)
- [x] `Promise.all([findMany({ where, skip, take: limit }), count({ where })])` — parallel queries
  - Runs BOTH queries simultaneously instead of sequentially — one round trip for data + count
  - `const [data, total] = await Promise.all([...])` — destructure both results
  - Both queries use the same `where` so the count reflects filtered results, not all rows
- [x] Return `{ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }`
  - `Math.ceil` rounds up — 11 results / 10 per page = 2 pages (not 1.1)
- [x] Update controller `findAll` — add `@Query() query: QueryDto`
  - Add `@Query() query: QueryPropertyDto` as a param and pass it to the service: `findAll(user.tenantId, query)`
  - **Swagger will still show "No parameters"** even with `@ApiPropertyOptional` on the DTO — query params require explicit `@ApiQuery` decorators on the controller route to appear in the UI:
    ```ts
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'city', required: false, example: 'Austin' })
    @ApiQuery({ name: 'state', required: false, example: 'TX' })
    @ApiQuery({ name: 'search', required: false, example: 'Sunset' })
    ```
  - Add `ApiQuery` to the `@nestjs/swagger` import line
  - `@ApiPropertyOptional` on the DTO controls validation/typing; `@ApiQuery` on the controller controls Swagger UI display — both are needed for the full picture
- [x] Test: `?page=1&limit=2`, `?city=Austin`, `?search=sunset` — confirm filtering and pagination work
- [ ] In psql: `EXPLAIN ANALYZE SELECT * FROM "[Resource]" WHERE "tenantId" = 1 AND city = 'Austin';`
  - Run from psql: `EXPLAIN ANALYZE SELECT * FROM "Property" WHERE "tenantId" = 1 AND city = 'Austin';`
  - `cost=0.00..X` — Postgres's ESTIMATE of work units (not milliseconds). Lower is cheaper. First number = startup cost, second = total cost
  - `actual time=X..Y` — REAL execution time in milliseconds. The number that actually matters
  - `Seq Scan` = scans every row in the table. Expected on small tables — Postgres planner chooses it deliberately when the table is tiny
- [x] Add index: `CREATE INDEX "[Resource]_city_idx" ON "[Resource]"(city);` — re-run EXPLAIN ANALYZE
  - After adding the index, re-run the same EXPLAIN ANALYZE and compare cost + actual time
  - **With small data (< ~1000 rows), Postgres will STILL show Seq Scan** — the planner knows scanning 3 rows is faster than using an index. This is correct behavior, not a bug
  - The index pays off at scale (thousands+ rows) — that's when the planner switches to `Index Scan` automatically
  - Planning time may increase slightly after adding index — planner now considers it as an option. The execution time savings at scale far outweigh this overhead

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

- [x] `npm install @nestjs/config joi @nestjs/throttler @nestjs/cache-manager cache-manager`
- [x] `ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({...}) })` in `AppModule`
- [x] Test startup validation: remove `JWT_SECRET` from `.env` → app should refuse to start
- [x] Update `JwtStrategy` — inject `ConfigService`, use `configService.getOrThrow<string>('JWT_SECRET')`
  - Add `ConfigService` to the constructor: `constructor(private configService: ConfigService)`
  - Update `secretOrKey` in `super()`: `secretOrKey: configService.getOrThrow<string>('JWT_SECRET')`
  - **Use `getOrThrow` NOT `get`** — `configService.get<string>()` returns `string | undefined`, causing TypeScript squiggles because `secretOrKey` expects a plain `string`. `getOrThrow` returns `string` (throws if missing) — types align and squiggles disappear
  - `getOrThrow` will never actually throw at runtime since Joi already validated `JWT_SECRET` exists at startup — but TypeScript doesn't know that, so `getOrThrow` is needed for type safety
  - Add `ConfigService` to imports at the top: `import { ConfigService } from '@nestjs/config'`
  - Remove the `process.env.JWT_SECRET!` line (comment it out for reference)
- [x] Update `JwtModule` — switch from `register()` to `registerAsync({ imports, inject, useFactory })`
  - This change is in `src/auth/auth.module.ts` — replace `JwtModule.register({...})` with `JwtModule.registerAsync({...})`
  - **Why registerAsync:** `register()` is synchronous and runs before DI is ready — it can't inject `ConfigService`. `registerAsync` waits for DI to resolve, then calls `useFactory` with the injected services
  - Shape:
    ```ts
    JwtModule.registerAsync({
      imports: [ConfigModule],       // make ConfigModule available in this context
      inject: [ConfigService],       // inject ConfigService into useFactory
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    ```
  - `imports` = which modules to pull in; `inject` = which services to pass to `useFactory`; `useFactory` = a function that receives those services and returns the config object
  - Add `ConfigModule` to the `imports` array at the top of the file: `import { ConfigModule } from '@nestjs/config'`
- [x] `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` in `AppModule` imports
- [x] `{ provide: APP_GUARD, useClass: ThrottlerGuard }` in `AppModule` providers
- [x] Add `@Throttle({ default: { ttl: 60000, limit: 5 } })` to `POST /auth/login` .. Note: this gets added to the `auth.controller` before the `@Post('login')` decorator.
- [x] Test 429: hit login 7 times in a loop, expect 5x 201 then 2x 429
- [x] `CacheModule.register({ isGlobal: true, ttl: 30000, max: 100 })` in `AppModule` imports
- [x] Inject `@Inject(CACHE_MANAGER) private cacheManager: Cache` into resource service
  - In `properties.service.ts` constructor: `@Inject(CACHE_MANAGER) private cacheManager: Cache`
  - Import: `import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'` — both `Cache` type AND `CACHE_MANAGER` token come from `@nestjs/cache-manager` (not split between packages)
  - Also import `Inject` from `@nestjs/common`
  - `@Inject(CACHE_MANAGER)` decorator is required — cache manager can't be injected by type alone like a regular service. Without it Nest doesn't know which provider to inject
- [x] Call `await this.cacheManager.clear()` after `create`, `update`, and `remove`
  - Pattern is always: **await Prisma call → store in variable → clear cache → return variable**
  - `clear()` must come AFTER the DB write succeeds — don't clear before the write or you'd clear cache even if the DB call fails
  - `clear()` must come BEFORE `return` — it's unreachable after a return statement
  - All three methods (`create`, `update`, `remove`) need the same pattern:
    ```ts
    const result = await this.prisma.property.[method]({...});
    await this.cacheManager.clear();
    return result;
    ```
  - Don't forget `async` on each method signature since you're using `await`
- [x] **DO NOT** add `@UseInterceptors(CacheInterceptor)` to tenant-scoped routes — URL-only cache key leaks data across tenants
- [x] Add `getHealth()` to `AppService` — returns `{ status: 'ok', timestamp: new Date().toISOString() }`
- [x] Add `@SkipThrottle() @Get('health') getHealth()` to `AppController`
- [x] Test multi-tenancy: insert second tenant in psql, get TOKEN1 + TOKEN2, confirm each only sees their own data
  - Insert second tenant: `psql hpos_v2_db` → `INSERT INTO "Tenant" (name) VALUES ('Company B');` → `\q`
  - No migration needed — inserting a row adds data to an existing table, migrations only change structure
  - Confirm row exists: `SELECT * FROM "Tenant";` in psql OR `npx prisma studio` → Tenant table
  - Login twice in Swagger — `tenantId: 1` and `tenantId: 2` — copy both tokens
  - Authorize with TOKEN1 → `GET /properties` → only tenant 1's properties
  - Authorize with TOKEN2 → `GET /properties` → only tenant 2's properties (or `[]` if none created yet)
  - `POST /properties` with TOKEN2 → creates a property under tenant 2 → `GET /properties` confirms isolation
  - Try `GET /properties/<tenant1-id>` with TOKEN2 → expect 404 (ownership check works)

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

# Phase 6: ConfigModule, Rate Limiting & Caching

Starting point: Phase 5 complete — full CRUD, JWT auth, RBAC, validation, pagination, and a full test suite.

Goal: Make the API production-ready. Replace raw `process.env` with validated config, protect endpoints from abuse with rate limiting, and cache read-heavy responses.

Difficulty: 3/5

---

## Step 1: Install dependencies

From inside `app/`:

```bash
npm install @nestjs/config joi @nestjs/throttler @nestjs/cache-manager cache-manager
```

- `@nestjs/config` — ConfigModule and ConfigService
- `joi` — schema validation for env vars at startup
- `@nestjs/throttler` — rate limiting
- `@nestjs/cache-manager` + `cache-manager` — in-memory response caching

---

## Step 2: Add ConfigModule to AppModule

In `app.module.ts`, import `ConfigModule` with a Joi validation schema:

```ts
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(16).required(),
    PORT: Joi.number().default(3000),
  }),
}),
```

**Test:** Remove `JWT_SECRET` from `.env` temporarily and restart. The app should refuse to start with a clear validation error. Put it back after.

**Understand:** Why does failing at startup matter more than failing on the first request?

---

## Step 3: Replace process.env with ConfigService in JwtStrategy

`JwtStrategy` uses `process.env.JWT_SECRET` directly. Update it to inject `ConfigService`:

```ts
constructor(private configService: ConfigService) {
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: configService.get<string>('JWT_SECRET'),
  });
}
```

Import `ConfigModule` in `AuthModule` and inject `ConfigService` in providers.

---

## Step 4: Replace process.env in AuthModule's JwtModule

`JwtModule.register()` can't use async injection. Switch to `registerAsync`:

```ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: '7d' },
  }),
}),
```

**Test:** Restart the server and verify login still works — `POST /auth/login` returns a token.

**Commit:**
```bash
git add .
git commit -m "feat: replace process.env with ConfigModule and ConfigService"
```

---

## Step 5: Add rate limiting globally

In `app.module.ts`, add `ThrottlerModule` and register `ThrottlerGuard` as a global guard:

```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// In imports:
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

// In providers:
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

This applies a 100 requests/minute limit to every route.

**Test:** The API should still work normally for regular requests.

---

## Step 6: Add stricter limit to the login route

The login endpoint is the most vulnerable to brute force. Override the global limit:

```ts
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { ttl: 60000, limit: 5 } })
@Post('login')
login(@Body() body: LoginDto) {
  return this.authService.login(body.tenantId, body.role);
}
```

**Test:** Hit `POST /auth/login` more than 5 times in a minute. Expected: **429 Too Many Requests** on the 6th attempt.

```bash
for i in {1..7}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"tenantId": 1, "role": "admin"}';
done
```

Expected output: five `201`s followed by two `429`s.

**Commit:**
```bash
git add .
git commit -m "feat: add rate limiting with stricter limit on login endpoint"
```

---

## Step 7: Add caching to GET /properties

In `app.module.ts`, add `CacheModule`:

```ts
import { CacheModule } from '@nestjs/cache-manager';

CacheModule.register({ isGlobal: true, ttl: 30000, max: 100 }),
```

In `properties.controller.ts`, add `CacheInterceptor` to `findAll`:

```ts
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

@UseInterceptors(CacheInterceptor)
@Get()
findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryPropertyDto) {
  return this.propertiesService.findAll(user.tenantId, query);
}
```

**Test:** Watch the terminal. The first `GET /properties` should show the logging interceptor firing and a database query. The second identical request should return faster with no database log.

**Understand:** What is the cache key for `GET /properties?city=Austin`? Is it the same or different from `GET /properties?city=Dallas`?

---

## Step 8: Invalidate cache on write

When a property is created, updated, or deleted, the cached list is stale. Clear the cache in the service after any write:

```ts
import { Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(dto: CreatePropertyDto, tenantId: number): Promise<Property> {
    const result = await this.prisma.property.create({ data: { ...dto, tenantId } });
    await this.cacheManager.reset();
    return result;
  }
  // Do the same in update() and remove()
}
```

**Test:** Create a property, then immediately GET /properties. The new property should appear (not the stale cached list).

**Commit:**
```bash
git add .
git commit -m "feat: add response caching with invalidation on writes"
```

---

## Phase 6 Complete

You've added:
- `ConfigModule` with Joi validation — app refuses to start with missing/invalid env vars
- `ConfigService` replacing all raw `process.env` usage
- Global rate limiting — 100 req/min across all routes
- Stricter rate limit on login — 5 attempts/min, 429 on excess
- Response caching on `GET /properties` — second request skips the database
- Cache invalidation on writes — data stays consistent after mutations

**Practice:** Add a `GET /health` endpoint that returns `{ status: 'ok', timestamp: Date.now() }` and use `@SkipThrottle()` so it's never rate-limited. Infrastructure uses health checks to verify the app is alive — it shouldn't burn the rate limit.

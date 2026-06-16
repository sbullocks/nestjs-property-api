# Module 15: Rate Limiting & API Protection

Without rate limiting, a single client can hammer the API with thousands of requests per second — crashing the server or brute-forcing the login endpoint. `@nestjs/throttler` adds rate limiting with minimal setup.

---

## 15.1 What Rate Limiting Does

Tracks how many requests a client (by IP) makes in a time window. If they exceed the limit, they get a **429 Too Many Requests** response until the window resets.

Common use cases:
- **Global limit** — 100 requests per minute across all routes (general protection)
- **Login route** — 5 attempts per minute (prevents brute-force password attacks)
- **Public search** — 20 requests per minute (prevents scraping)

---

## 15.2 Setup

```bash
npm install @nestjs/throttler
```

In `app.module.ts`:
```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,   // time window in milliseconds (60 seconds)
      limit: 100,   // max requests per window per IP
    }]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,   // applies globally to every route
    },
  ],
})
export class AppModule {}
```

`APP_GUARD` is a NestJS token — using it registers `ThrottlerGuard` as a global guard through DI, unlike `app.useGlobalGuards()` which is outside DI. The DI version is preferred because it allows injection of dependencies.

---

## 15.3 Custom Limits Per Route

Override the global limit on specific routes with `@Throttle()`:

```ts
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { ttl: 60000, limit: 5 } })  // 5 attempts per minute
@Post('login')
login(@Body() body: LoginDto) {
  return this.authService.login(body.tenantId, body.role);
}
```

Brute-force protection on login: if someone tries more than 5 times in a minute, they're blocked until the window resets.

---

## 15.4 Skipping Rate Limiting

Skip throttling on specific routes (e.g., health checks):

```ts
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}
```

---

## 15.5 Testing Rate Limits

In e2e tests, throttling can block your own test requests. Skip it in the test module:

```ts
import { ThrottlerModule } from '@nestjs/throttler';

// In test module setup — override with very high limits
Test.createTestingModule({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 9999 }]),
    AppModule,
  ],
})
```

Or use `@SkipThrottle()` in a test-specific controller override.

> **Docs:** https://docs.nestjs.com/security/rate-limiting

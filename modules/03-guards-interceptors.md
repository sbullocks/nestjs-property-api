# Module 3: Guards + Interceptors

Guards and interceptors are two distinct layers in the NestJS request pipeline. Guards decide if a request is allowed. Interceptors wrap the request/response to add cross-cutting behavior.

---

## 3.1 The Request Pipeline

```
Request
  → Middleware       (Express-level, no route knowledge)
  → Guards           (allow or deny)
  → Interceptors     (before handler)
  → Pipes            (validate/transform input)
  → Handler          (your controller method)
  → Interceptors     (after handler)
  → Response
```

---

## 3.2 Guards

A guard answers one question: **should this request be allowed to proceed?**

Guards implement `CanActivate` and return `true` (allow) or throw an exception (deny).

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey === process.env.API_KEY) {
      return true;
    }

    throw new UnauthorizedException();
  }
}
```

Apply to a controller — protects every route inside it:

```ts
@UseGuards(ApiKeyGuard)
@Controller('properties')
export class PropertiesController { ... }
```

> Pass the class — do NOT use `new ApiKeyGuard()`. NestJS DI handles instantiation.

Test with curl:
```bash
# Missing header — 401
curl http://localhost:3000/properties

# With header — 200
curl -H "x-api-key: secret" http://localhost:3000/properties
```

> **Docs:** https://docs.nestjs.com/guards

---

## 3.3 Guard vs Middleware

This is a common interview question and an important architectural distinction.

| | Middleware | Guard |
|---|---|---|
| Runs | Before routing | After routing |
| Knows which handler will run | No | Yes |
| Access to ExecutionContext | No | Yes |
| Can read handler metadata (`@SetMetadata`) | No | Yes |
| Use for | Logging, CORS, body parsing | Authorization |

**Why this matters:** Guards know which controller and method are being called. That means you can attach metadata to specific handlers and read it in the guard:

```ts
@Roles('admin')        // sets metadata on this handler only
@Get()
findAll() {}

// In the guard:
const roles = this.reflector.get<string[]>('roles', context.getHandler());
```

Middleware runs too early — it sees the raw request before routing, so it cannot know which handler will run or what metadata is attached. **Always use guards for authorization.**

---

## 3.4 How Request Headers Work

A critical concept: **the client sends headers, the server reads them.**

The guard does not create or add the `x-api-key` header. It only checks whether the header exists in the incoming request. When you run:

```bash
curl -H "x-api-key: secret" http://localhost:3000/properties
```

You (the client) attached the header to the request. The guard reads it and checks its value. If the guard is removed from the controller, the endpoint is unprotected — requests succeed whether or not the header is present.

Think of it like:
- Header = badge the client is wearing
- Guard = security check reading the badge
- Remove the guard = nobody checks the badge, but it's still there

---

## 3.5 API Key vs JWT

Both are auth mechanisms — different tools for different problems.

| | API Key | JWT |
|---|---|---|
| Format | Static string | Signed token containing claims |
| Check | Does this key match? | Is this signature valid? |
| Contains | Nothing — just an identity | User ID, roles, expiry, etc. |
| Good for | Service-to-service | User sessions |
| Header | `x-api-key: <key>` | `Authorization: Bearer <token>` |

In development, you hardcode a placeholder (`'secret'`). In production, read from `process.env.API_KEY` and store it in a secrets manager (Azure Key Vault for this stack). The guard pattern is identical — only the logic inside `canActivate` changes.

---

## 3.6 Interceptors

An interceptor wraps the entire request/response cycle. Use them for cross-cutting concerns — logging, timing, response transformation, caching.

Interceptors implement `NestInterceptor`. The `intercept` method receives `ExecutionContext` (same as guards) and `CallHandler`. Calling `next.handle()` executes the route handler and returns an RxJS `Observable`.

```ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    console.log(`[${method}] ${url} — incoming`);

    return next.handle().pipe(
      tap(() => console.log(`[${method}] ${url} — ${Date.now() - start}ms`)),
    );
  }
}
```

**Why RxJS/Observable?**
NestJS's async pipeline is built on RxJS. `next.handle()` returns an Observable that resolves when the handler completes. `tap` lets you run side-effect logic (logging) after the handler fires without modifying the response.

Apply globally in `main.ts`:

```ts
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

app.useGlobalInterceptors(new LoggingInterceptor());
```

> **Docs:** https://docs.nestjs.com/interceptors  
> **RxJS tap:** https://rxjs.dev/api/operators/tap

---

## 3.7 Why `new` in main.ts but Not in @UseGuards()

This trips up almost everyone the first time.

`app.useGlobalInterceptors(new LoggingInterceptor())` — called **outside** the NestJS DI context (in `main.ts`, before the container is fully wired). NestJS cannot inject dependencies here, so you instantiate manually with `new`.

`@UseGuards(ApiKeyGuard)` — called **inside** the DI context (a decorator on a class). NestJS reads the class token and resolves it through the DI container. It handles instantiation and injects any constructor dependencies automatically.

| | DI available? | Use |
|---|---|---|
| `@UseGuards(MyGuard)` | Yes | Pass the class |
| `app.useGlobalInterceptors(...)` | No | Use `new` |
| `app.useGlobalGuards(...)` | No | Use `new` |

---

## 3.8 curl -H Syntax (Common Mistake)

`-H` requires a value immediately after it. If you drop the header value without removing `-H`, curl treats your URL as the header value:

```bash
# WRONG — curl error: "no URL specified"
curl -v -H http://localhost:3000/properties

# CORRECT — no header at all
curl -v http://localhost:3000/properties

# CORRECT — with header
curl -v -H "x-api-key: secret" http://localhost:3000/properties
```

Use `-v` (verbose) to see request headers you sent (lines starting with `>`) and response headers (lines starting with `<`).

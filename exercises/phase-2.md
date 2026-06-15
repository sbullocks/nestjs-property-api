# Phase 2: JWT Auth + RBAC + OpenAPI

Starting point: Phase 1 complete — NestJS API running with Prisma, PostgreSQL, ApiKeyGuard, LoggingInterceptor, and multi-tenant isolation.

Goal: Replace the API key with real JWT authentication, add role-based access control, and generate API documentation with Swagger.

---

## Step 1: Install dependencies

From inside `app/`:

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger
npm install --save-dev @types/passport-jwt
```

Add `JWT_SECRET` to `.env`:
```
JWT_SECRET=your-super-secret-key-change-in-production
```

**Commit:**
```bash
git add .
git commit -m "chore: install JWT, Passport, and Swagger dependencies"
```

---

## Step 2: Create the Role enum

Create `src/common/enums/role.enum.ts`:

```ts
export enum Role {
  Admin = 'admin',
  TenantUser = 'tenant_user',
  Viewer = 'viewer',
}
```

---

## Step 3: Create the JWT payload interface

Create `src/auth/interfaces/jwt-payload.interface.ts`:

```ts
export interface JwtPayload {
  sub: number;
  tenantId: number;
  role: string;
}
```

---

## Step 4: Generate the Auth module

From inside `app/`:

```bash
nest generate module auth
nest generate service auth
nest generate controller auth
```

**Understand:** What does the auth module need to own? What will it export?

---

## Step 5: Create the JWT Strategy

Create `src/auth/jwt.strategy.ts`. Extend `PassportStrategy(Strategy)`. In the constructor call `super()` with:
- `jwtFromRequest`: extract from Bearer token
- `ignoreExpiration`: false
- `secretOrKey`: from `process.env.JWT_SECRET`

Implement `validate(payload: JwtPayload)` — return the payload so it gets attached to `request.user`.

See Module 7 for the full pattern.

---

## Step 6: Wire up AuthModule

In `src/auth/auth.module.ts`:
- Import `PassportModule`
- Import `JwtModule.register()` with secret and expiry from `.env`
- Add `AuthService` and `JwtStrategy` to providers

**Understand:** Why does JwtModule need to be imported here? What does PassportModule add?

---

## Step 7: Create the login endpoint

In `src/auth/auth.service.ts`, create a `login` method that:
- Accepts `tenantId: number` and `role: string`
- Signs a JWT with `{ sub: tenantId, tenantId, role }`
- Returns `{ access_token: string }`

In `src/auth/auth.controller.ts`, create a `POST /auth/login` route that calls the service and returns the token.

For now, skip password validation — just accept `tenantId` and `role` in the body and sign the token directly. Real credential validation comes later.

Test with curl:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}'
```

Expected: `{ "access_token": "eyJ..." }`

**Commit:**
```bash
git add .
git commit -m "feat: add AuthModule with JWT login endpoint"
```

---

## Step 8: Create JwtAuthGuard

Create `src/common/guards/jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Understand:** Why is this so short? What is `AuthGuard('jwt')` doing under the hood?

---

## Step 9: Create @Roles() decorator

Create `src/common/decorators/roles.decorator.ts`. Use `SetMetadata` to attach roles to a handler. Export `ROLES_KEY` constant and `Roles` decorator function.

See Module 8 for the pattern.

---

## Step 10: Create RolesGuard

Create `src/common/guards/roles.guard.ts`. Implement `CanActivate`. Use `Reflector` to read required roles from the handler. Compare against `request.user.role`.

See Module 8 for the full implementation.

**Understand:** Why does `RolesGuard` need `Reflector`? What is `getAllAndOverride` doing?

---

## Step 11: Create @CurrentUser() decorator

Create `src/common/decorators/current-user.decorator.ts`. Use `createParamDecorator` to extract `request.user` and return it typed as `JwtPayload`.

See Module 8 for the pattern.

---

## Step 12: Replace ApiKeyGuard with JwtAuthGuard + RolesGuard

In `properties.controller.ts`:
- Remove `@UseGuards(ApiKeyGuard)` and its import
- Add `@UseGuards(JwtAuthGuard, RolesGuard)`
- Update `findAll` to use `@CurrentUser()` and pass `user.tenantId` to the service
- Add `@Roles(Role.Admin)` to the `remove` route

Update `PropertiesService.findAll` — it already accepts `tenantId`, no change needed.

Test with curl:
```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}' | jq -r '.access_token')

# Use the token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/properties
```

Expected: `[]`

Without the token:
```bash
curl http://localhost:3000/properties
```

Expected: `401 Unauthorized`

**Commit:**
```bash
git add .
git commit -m "feat: replace ApiKeyGuard with JwtAuthGuard and RolesGuard"
```

---

## Step 13: Add Swagger

In `main.ts`, add the Swagger setup before `app.listen()`. See Module 9 for the full setup.

Add `@ApiProperty()` to all fields in `CreatePropertyDto` and `UpdatePropertyDto`.

Add `@ApiTags('properties')` and `@ApiBearerAuth()` to `PropertiesController`.

Visit `http://localhost:3000/api` — you should see the full interactive docs.

Test the "Authorize" button in the UI:
1. Get a token from the login endpoint
2. Click "Authorize" and enter `Bearer <your_token>`
3. Try `GET /properties` — should return `[]`

**Commit:**
```bash
git add .
git commit -m "feat: add Swagger API documentation"
```

---

## Phase 2 Complete

You've added:
- JWT authentication replacing the API key
- Login endpoint that issues signed tokens
- JwtAuthGuard protecting all routes
- Role-based access control with `@Roles()` decorator and RolesGuard
- `@CurrentUser()` decorator for clean access to the JWT payload
- tenantId now comes from the JWT instead of being hardcoded
- Swagger docs auto-generated from decorators

**Practice:** Redo Phase 2 from scratch using only the cheatsheet and my-notes. When you can do both Phase 1 and Phase 2 back to back without references, you're ready for Phase 3.

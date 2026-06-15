# Module 7: JWT Authentication

Phase 1 used a hardcoded API key. Phase 2 replaces it with JWT — the industry standard for user authentication. Instead of a static shared secret, each user gets a signed token that contains their identity and expires automatically.

---

## 7.1 What JWT Is

JWT (JSON Web Token) is a signed token that contains claims — data about the user packed into the token itself.

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJhZG1pbiJ9.abc123
```

Three parts separated by dots:
1. **Header** — algorithm used to sign (`HS256`)
2. **Payload** — the claims (user id, role, expiry)
3. **Signature** — proof it wasn't tampered with

The server signs the token with a secret key. Anyone can read the payload, but only someone with the secret key can create a valid signature. The server verifies the signature on every request.

| API Key | JWT |
|---|---|
| Static shared secret | Signed token with expiry |
| No identity info inside | Contains user id, roles, expiry |
| Never expires unless rotated | Expires automatically |
| Good for service-to-service | Good for user sessions |
| Header: `x-api-key: <key>` | Header: `Authorization: Bearer <token>` |

---

## 7.2 The Auth Flow

```
1. User sends POST /auth/login with email + password
2. Server validates credentials
3. Server signs a JWT with { sub: userId, tenantId, role }
4. Server returns the JWT to the client
5. Client stores the token (localStorage or cookie)
6. Every subsequent request includes: Authorization: Bearer <token>
7. JwtAuthGuard intercepts the request
8. Guard verifies the signature and extracts the payload
9. Payload is attached to request.user
10. Controller/service reads tenantId and role from request.user
```

This replaces the hardcoded `tenantId: 1` from Phase 1 — now `tenantId` comes from the JWT automatically.

---

## 7.3 Packages

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install --save-dev @types/passport-jwt
```

| Package | Role |
|---|---|
| `@nestjs/jwt` | NestJS wrapper for JWT signing/verifying |
| `@nestjs/passport` | NestJS wrapper for Passport auth strategies |
| `passport` | Auth middleware library |
| `passport-jwt` | Passport strategy for JWT verification |

---

## 7.4 JWT Payload

The payload is what gets packed into the token. Define it as an interface:

```ts
export interface JwtPayload {
  sub: number;        // subject — the user/tenant id
  tenantId: number;   // for multi-tenant scoping
  role: string;       // for RBAC
}
```

`sub` is the standard JWT claim for "subject" — who the token is about.

---

## 7.5 JWT Strategy

The strategy tells Passport how to extract and validate the JWT:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    return payload; // attached to request.user
  }
}
```

`jwtFromRequest` — tells Passport where to look for the token. `fromAuthHeaderAsBearerToken()` reads `Authorization: Bearer <token>`.

`validate()` — runs after the signature is verified. Whatever you return here gets attached to `request.user`. In this case the full payload — so `request.user.tenantId` is available everywhere.

---

## 7.6 Auth Module

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

---

## 7.7 Auth Service — Login

```ts
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(tenantId: number, role: string): Promise<{ access_token: string }> {
    const payload: JwtPayload = { sub: tenantId, tenantId, role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
```

In a real app, you'd validate email/password against the database first. For Phase 2 we'll keep it simple and just sign the token.

---

## 7.8 JwtAuthGuard

Replaces `ApiKeyGuard`. Uses Passport under the hood:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

That's it — `AuthGuard('jwt')` tells Passport to use the JWT strategy. Passport handles the token extraction, signature verification, and attaching the payload to `request.user`.

Apply to the controller:
```ts
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {}
```

---

## 7.9 Reading tenantId from the Token

Now instead of hardcoding `tenantId: 1`, extract it from the JWT:

```ts
// Controller
@Get()
findAll(@Req() req) {
  return this.propertiesService.findAll(req.user.tenantId);
}

// Or with a custom @CurrentUser() decorator (cleaner):
@Get()
findAll(@CurrentUser() user: JwtPayload) {
  return this.propertiesService.findAll(user.tenantId);
}
```

This is the payoff from Phase 1's multi-tenant setup — the tenantId now comes from a verified, signed token instead of a hardcoded value.

> **Docs:** https://docs.nestjs.com/security/authentication  
> **Docs:** https://docs.nestjs.com/security/authorization

# Module 14: ConfigModule & Environment Validation

Using `process.env.JWT_SECRET` directly throughout the codebase has problems: no validation that the value actually exists at startup, no type safety, and no central place to manage configuration. `@nestjs/config` solves all three.

---

## 14.1 The Problem with Raw process.env

```ts
// Scattered across the codebase — no guarantee this exists at startup
secret: process.env.JWT_SECRET,
```

If `JWT_SECRET` is missing from `.env`, the app starts anyway. The first login request fails at runtime. With `ConfigModule`, missing required env vars throw at startup — fail fast, fail clearly.

---

## 14.2 Setup

```bash
npm install @nestjs/config joi
```

`@nestjs/config` provides `ConfigModule` and `ConfigService`.
`joi` validates the shape and types of env vars at startup.

In `app.module.ts`:
```ts
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,    // available everywhere without importing in each module
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        PORT: Joi.number().default(3000),
      }),
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

`isGlobal: true` — same as `@Global()` on PrismaModule. Import once, available everywhere.

`validationSchema` — Joi schema that runs at startup. If `JWT_SECRET` is missing or less than 16 characters, the app refuses to start with a clear error message.

---

## 14.3 Using ConfigService

Instead of `process.env.X`, inject `ConfigService`:

```ts
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }
}
```

`configService.get<string>('JWT_SECRET')` — typed, validated, reads from the loaded config. No more `!` non-null assertions.

---

## 14.4 ConfigService in AuthModule

`JwtModule.register()` doesn't support async config. Use `registerAsync` instead:

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

`registerAsync` + `useFactory` is the pattern for any NestJS module that needs env vars injected at registration time.

---

## 14.5 Environment-Specific Config

Different environments need different values. Use separate `.env` files:

```
.env           — local development
.env.test      — test environment (different database)
.env.production — production (never committed, lives on the server)
```

All `.env*` files go in `.gitignore`. Only `.env.example` (no real values) gets committed so other developers know which vars are needed.

> **Docs:** https://docs.nestjs.com/techniques/configuration

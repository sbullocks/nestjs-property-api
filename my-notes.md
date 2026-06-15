# My Notes — In My Own Words

Personal understanding checkpoints as I work through this curriculum. Written the way I actually understand it, not the way docs explain it.

---

## Starting a NestJS Project

`nest new <name>` creates the project. `cd` into it. `npm run start:dev` fires it up.

The `:dev` part puts the terminal in watch mode — it's always watching for file changes and will recompile and restart automatically when I save something.

When it starts, the terminal output isn't a tree — it's NestJS logging its startup sequence. I can read exactly what's happening line by line:

```
InstanceLoader  — AppModule dependencies initialized   → DI graph built, services instantiated
RoutesResolver  — AppController {/}                    → controller registered, routes scanned
RouterExplorer  — Mapped {/, GET}                      → GET / route registered
NestApplication — Nest application successfully started → now listening for requests
```

---

## What's Actually Happening at Startup vs on a Request

At startup NestJS is doing the wiring — reading the module, creating instances of services, connecting them to controllers. Nothing from the service runs yet.

When a request actually comes in THEN the controller calls the service method and the service runs and returns something.

So startup = wiring. Request = execution. Nothing runs until someone hits the route.

---

## The Flow of a Request (Hello World Example)

1. `AppModule` declares `AppController` and `AppService` — this is how NestJS knows they exist
2. NestJS reads `@Get()` on the controller and registers `GET /` as a route
3. User hits `localhost:3000` in the browser (a GET request)
4. Controller receives it and calls `this.appService.getHello()`
5. `AppService.getHello()` returns `'Hello World!'`
6. That string goes back as the HTTP response

The controller doesn't do the work. It just receives the request and hands it off to the service. The service does the actual work.

---

## How the Controller Knows Which Service and Method to Call

`this.appService.getHello()` — two parts:

- `this.appService` — which service instance to use
- `.getHello()` — which method on that service to call

If I had multiple services injected, I'd navigate to each one the same way:

- `this.appService.getHello()` → AppService
- `this.propertiesService.findAll()` → PropertiesService

It's just JavaScript object navigation. `this.x` = which service, `.x()` = which method.

---

## The Constructor — Storing the Service

Before I can call `this.appService` in a method, the service has to be stored on the class. That's what the constructor does.

The long way:

```ts
private readonly appService: AppService;

constructor(appService: AppService) {
  this.appService = appService;
}
```

The shorthand that does the exact same thing:

```ts
constructor(private readonly appService: AppService) {}
```

TypeScript collapses the declaration and assignment into one line. Same result — `this.appService` is now available in every method in the class.

If I need more than one service, same constructor, separate parameters:

```ts
constructor(
  private readonly appService: AppService,
  private readonly propertiesService: PropertiesService,
) {}
```

One constructor. Never multiple.

---

## private and readonly — The Keycard Analogy

Think of it like a company keycard.

**private** — the keycard is issued to me personally. My coworker can't borrow it or use mine. If they need access, they get their own keycard. In code, if `CatController` needs `AppService`, it just injects its own copy — it doesn't reach into `AppController` and grab its version.

**readonly** — once the company issues me the keycard at the start of the day, nobody can swap it out for a different one mid-day. The injected service won't be replaced after startup.

Without `private` the keycard is left on my desk. Anyone walking by can pick it up and use it directly — bypassing the proper flow entirely. In code that means someone could skip the route and call the service directly from anywhere in the codebase. In a large team that becomes chaos fast.

So `private readonly` = this service is mine, it's locked in, and nobody outside this class touches it.

---

## NestJS vs React/RTK Query

RTK Query is the closest comparison on the frontend side:

| RTK Query (client) | NestJS (server) |
|---|---|
| endpoint definition | controller route |
| query/mutation | service method |
| cache/state | database via Prisma |

Both are structured pipelines where each layer has one job. RTK Query manages server state in the browser. NestJS is the server — it's what RTK Query is talking to.

---

## Phase 2 — JWT Auth, RBAC, OpenAPI

### Goal of Phase 2

Replace the hardcoded API key from Phase 1 with real JWT authentication, add role-based access control so different users have different permissions, and generate API documentation with Swagger for users who don't interact with a UI.

---

### Installing Dependencies

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger
npm install --save-dev @types/passport-jwt
```

- `@nestjs/jwt` — signs and verifies JWT tokens
- `@nestjs/passport` / `passport` — authentication middleware that NestJS wraps. Passport handles the strategy pattern for verifying tokens
- `passport-jwt` — the specific Passport strategy for JWT verification
- `@nestjs/swagger` — generates the Swagger/OpenAPI documentation UI from decorators
- `@types/passport-jwt` — TypeScript types for passport-jwt (dev only, not shipped to production)

Add to `.env`:
```
JWT_SECRET=your-super-secret-key-change-in-production
```

---

### What JWT Is

JSON Web Token — a signed token composed of 3 parts separated by dots:
1. **Header** — the algorithm used to sign it (`HS256`)
2. **Payload** — the claims (user id, tenantId, role, expiry)
3. **Signature** — proof the token wasn't tampered with

Anyone can read the payload, but only the server with the secret key can create a valid signature. Expires automatically — unlike the API key which never expires.

Sent on every request as: `Authorization: Bearer <token>`

---

### JWT Payload Interface

The payload is what gets packed into the token. Define it as a TypeScript interface so it's typed everywhere:

```ts
// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: number;        // subject — standard JWT claim, conventionally the user's ID
  tenantId: number;   // for multi-tenant query scoping
  role: string;       // for RBAC
}
```

**Note on `sub` vs `tenantId`:** In this demo we set `sub: tenantId` as a shortcut. In a real system, `sub` would be the authenticated user's ID (from a users table) and `tenantId` would be a separate claim — because one user can belong to one tenant, but they're not the same concept. Don't conflate them.

---

### Role Enum

Defines valid roles as an enum so TypeScript catches typos and refactoring is safe:

```ts
// src/common/enums/role.enum.ts
export enum Role {
  Admin = 'admin',
  TenantUser = 'tenant_user',
  Viewer = 'viewer',
}
```

Using raw strings like `'admin'` everywhere is fragile — one typo and access is broken silently. The enum makes it a compiler error instead.

---

### RBAC — How It Works

Three pieces work together:
1. **Role enum** — defines the valid roles
2. **@Roles() decorator** — marks which roles can access a specific route
3. **RolesGuard** — reads the role from the JWT and compares it to the required roles

Two separate jobs, two separate guards:
- **JwtAuthGuard** → authentication: is this token real and not expired? Decodes it and attaches the payload to `request.user`.
- **RolesGuard** → authorization: does this user's role match what this route requires?

JwtAuthGuard doesn't care about roles. RolesGuard doesn't re-read or re-verify the raw JWT token — by the time it runs, JwtAuthGuard has already decoded it and placed the payload on `request.user`. RolesGuard just reads `request.user.role` that's already sitting there.

```
1. JwtAuthGuard  → decodes + verifies token → attaches payload to request.user
2. RolesGuard    → reads request.user.role (already decoded) → compares to @Roles() metadata
```

No double-reading of the token. The work is already done by step 2.

Similar to an AWS/enterprise system where different IAM roles have different permissions. Admin can do everything, TenantUser can only see their own data, Viewer can only read.

---

### @Roles() Decorator — What It Actually Does

`@SetMetadata('roles', ['admin'])` attaches invisible metadata to the route handler — like a sticky note on the function. It doesn't execute anything and doesn't protect anything by itself. It just stores the data. RolesGuard is what reads it and enforces it.

`@Roles(Role.Admin)` is just a cleaner wrapper around SetMetadata:

```ts
// These two do the exact same thing:
@SetMetadata('roles', ['admin'])    // raw — error-prone string literal
@Roles(Role.Admin)                  // wrapper — uses ROLES_KEY constant, typo-proof
```

The `ROLES_KEY` constant is used in both the decorator and the guard so there's one source of truth for the metadata key string instead of hoping every `'roles'` string is spelled consistently.

**No `@Roles()` on a route = open to all authenticated users.**

Inside RolesGuard:
```ts
const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [...]);
if (!requiredRoles) return true;  // no metadata found = any valid JWT passes
```

JwtAuthGuard still runs first — so a request with no token still gets a 401. But once the token is verified, if the route has no `@Roles()` attached, any role gets through.

---

### Reflector and getAllAndOverride

`Reflector` is a NestJS utility that reads metadata attached by decorators. RolesGuard uses it to ask: "what roles did the developer put on this route?"

`getAllAndOverride` handles the case where `@Roles()` exists at both the controller level AND the method level. **The more specific one wins — method overrides class.**

```ts
@Roles(Role.Admin)               // class-level: whole controller requires Admin by default
@Controller('properties')
export class PropertiesController {

  @Get()
  findAll() { ... }              // no method-level @Roles → inherits Admin from class

  @Roles(Role.Viewer)            // method-level → OVERRIDES the class-level
  @Get(':id')
  findOne() { ... }              // Viewers can access this one even though class says Admin
}
```

`getAllAndOverride` checks the **handler (method) first**, then falls back to the **class (controller)** if the method has nothing. If neither has `@Roles()`, returns `undefined` → guard returns `true` → open to all authenticated users.

The alternative is `getAllAndMerge` which combines both lists. `getAllAndOverride` says the specific beats the general — which is almost always what you want.

---

### Feature Module Pattern

When generating auth:
```bash
nest generate module auth      # creates auth.module.ts, updates app.module.ts imports
nest generate service auth     # creates auth.service.ts, updates auth.module.ts providers
nest generate controller auth  # creates auth.controller.ts, updates auth.module.ts controllers
```

Same pattern as when we created Properties. NestJS calls this the Feature Module Pattern — each feature owns its own module, service, and controller.

---

### JWT Strategy

The strategy tells Passport how to extract and verify the JWT on every request:

```ts
// src/auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,  // ! = non-null assertion
    });
  }

  async validate(payload: JwtPayload) {
    return payload; // attached to request.user after signature is verified
  }
}
```

**`process.env.JWT_SECRET!`** — the `!` is a TypeScript non-null assertion. `process.env.X` is typed as `string | undefined` because TypeScript can't guarantee the env var exists. The `!` tells TypeScript "I know this won't be undefined, trust me." Safe here because we control the `.env` file.

`validate()` runs after the signature is verified. Whatever is returned here gets attached to `request.user` — so `request.user.tenantId` and `request.user.role` are available in every controller method.

---

### Auth Module

```ts
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

`JwtModule.register()` configures the JWT signing options globally for this module. `expiresIn: '7d'` means every token expires after 7 days automatically.

---

### Auth Service — Login

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

`jwtService.sign(payload)` creates and signs the token. Returns it as `access_token` — this is what the client stores and sends on every future request.

---

### Auth Controller — Login Endpoint

```ts
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { tenantId: number; role: string }) {
    return this.authService.login(body.tenantId, body.role);
  }
}
```

`@Post('login')` must be INSIDE the class body. A common mistake is placing it outside the closing `}` — it becomes a decorator with nothing to attach to.

Test:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}'
# Expected: { "access_token": "eyJ..." }
```

---

### Full Authentication Flow

1. User sends `POST /auth/login` with tenantId and role (later: email + password)
2. **Current demo:** Server skips validation and signs immediately — no credentials checked. **Real production flow:** Server looks up the user in the database, verifies the password, then signs the JWT.
3. Server returns the JWT to the client
4. Client stores the token (localStorage or cookie)
5. Every subsequent request includes `Authorization: Bearer <token>`
6. `JwtAuthGuard` intercepts — Passport extracts and verifies the signature
7. `validate()` runs — payload attached to `request.user`
8. Controller reads `user.tenantId` and `user.role` from `request.user`

**This replaces the hardcoded `tenantId: 1` from Phase 1** — tenantId now comes from the verified JWT automatically.

---

### JwtAuthGuard

```ts
// src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Short on purpose. `AuthGuard('jwt')` is a factory from `@nestjs/passport` that returns a fully built guard class already wired to the `'jwt'` Passport strategy. It handles extracting the Bearer token, verifying the signature, and throwing a 401 if invalid. We're just extending it — not reimplementing it.

`@Injectable()` is still required so NestJS DI can instantiate it when `@UseGuards(JwtAuthGuard)` is used on a controller.

---

### @CurrentUser() Decorator

Instead of injecting `@Req() req` and writing `req.user` everywhere, create a clean param decorator that extracts `request.user` directly:

```ts
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Usage in controller:
```ts
@Get()
findAll(@CurrentUser() user: JwtPayload) {
  return this.propertiesService.findAll(user.tenantId);
}
```

`createParamDecorator` is a NestJS utility for building custom parameter decorators. The callback receives the execution context and returns whatever value should be injected into the parameter. Here it returns `request.user` — the already-decoded JWT payload that JwtAuthGuard placed there.

---

### Applying Both Guards to the Controller

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.propertiesService.findAll(user.tenantId);   // tenantId from JWT, not hardcoded
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(+id);
  }
}
```

- `@Get()` — no `@Roles()` → open to all authenticated users
- `@Delete(':id')` — `@Roles(Role.Admin)` → only admins can delete

**401 vs 403:**
- **401 Unauthorized** — no token or invalid token. JwtAuthGuard blocks it. "Who are you?"
- **403 Forbidden** — valid token, wrong role. RolesGuard blocks it. "I know who you are — you can't do this."

---

### TypeScript Gotchas in NestJS

**Swagger can't read inline types — always use a DTO class:**

```ts
// Wrong — Swagger sends empty body, body is undefined at runtime
login(@Body() body: { tenantId: number; role: string }) { ... }

// Correct — Swagger reads @ApiProperty() at runtime and builds the form
login(@Body() body: LoginDto) { ... }
```

TypeScript types (`{ tenantId: number; role: string }`) are erased after compilation — they don't exist at runtime. Swagger can only read class-based DTOs with `@ApiProperty()` decorators because those are real JavaScript objects that survive compilation. Without this, "Try it out" sends an empty body and the controller throws a 500 because `body` is undefined.

---

**`import type` for interfaces in decorated signatures:**
```ts
// Wrong — TypeScript error ts(1272) with isolatedModules + emitDecoratorMetadata
import { JwtPayload } from '...';

// Correct
import type { JwtPayload } from '...';
```

When `isolatedModules: true` and `emitDecoratorMetadata: true` are both on (NestJS tsconfig has both), TypeScript tries to emit runtime type metadata for decorated method parameters. An interface has no runtime value — it only exists in TypeScript. Using `import type` tells TypeScript not to emit it. You'll see this in every NestJS project.

**No semicolons after decorators:**
```ts
@UseGuards(JwtAuthGuard, RolesGuard);  // WRONG — semicolon breaks it
@UseGuards(JwtAuthGuard, RolesGuard)   // correct
export class PropertiesController { ... }
```

Decorators sit directly on top of what they decorate with no punctuation.

---

### Testing JWT Flow End-to-End

Install `jq` first — parses JSON in the terminal, used constantly with APIs:
```bash
brew install jq
```

Get a token and use it in one command:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}' | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/properties
```

Without a token (should get 401):
```bash
curl http://localhost:3000/properties
```

With a token but wrong role (should get 403 — once delete is role-restricted):
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "viewer"}' | jq -r '.access_token')

curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3000/properties/1
```

---

### Swagger / OpenAPI (Step 13)

Swagger auto-generates interactive API documentation from decorators — no separate doc writing needed. Visit `http://localhost:3000/api` once set up.

**Setup in `main.ts`:**
```ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('HPOS API')
  .setDescription('Property management API')
  .setVersion('1.0')
  .addBearerAuth()   // adds the Authorize button to the UI
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

This goes before `app.listen()`.

**Decorate the controller:**
```ts
@ApiTags('properties')      // groups routes under "properties" in the UI
@ApiBearerAuth()            // shows the padlock — route requires JWT
@Controller('properties')
export class PropertiesController {

  @ApiOperation({ summary: 'Get all properties for the current tenant' })
  @ApiResponse({ status: 200, description: 'Returns array of properties' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload) { ... }
}
```

**Decorate DTOs** so Swagger knows the request body shape:
```ts
import { ApiProperty } from '@nestjs/swagger';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Apartments' })
  name: string;

  @ApiProperty({ example: '123 Main St' })
  address: string;

  @ApiProperty({ example: 'Austin' })
  city: string;

  @ApiProperty({ example: 'TX' })
  state: string;
}
```

Without `@ApiProperty()`, Swagger shows the request body as empty in the UI.

**Using the Swagger UI:**
1. Visit `http://localhost:3000/api`
2. Click "Authorize" → enter the token from the login endpoint
3. Try `GET /properties` → should return tenant data
4. Try `DELETE /properties/1` with a viewer token → should get 403

---

## Phase 3 — Validation + Complete CRUD + Error Handling

### Goal of Phase 3

Replace all scaffold stub methods (`'This action adds a new property'`) with real Prisma operations, add input validation to every DTO so bad data is rejected at the boundary, and return proper HTTP errors instead of crashing with 500s.

---

### Why class-validator AND class-transformer

Two separate libraries with two separate jobs:

- **class-validator** — defines what valid data looks like via decorators (`@IsString()`, `@IsNotEmpty()`, etc.). Runs the validation checks.
- **class-transformer** — converts the incoming plain JSON object into a typed class instance so the decorators can actually run against it. Without this, the body is just a raw JavaScript object — class-validator can't inspect it.

```bash
npm install class-validator class-transformer
```

You always need both. class-validator defines the rules. class-transformer makes the data into something class-validator can check.

---

### ValidationPipe — Global Setup

Add to `main.ts` before `app.listen()`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,   // strips fields not in the DTO — security feature
    transform: true,   // auto-converts JSON to typed class instances
  }),
);
```

**`whitelist: true`** — if a request body includes extra fields not defined in the DTO, they are silently stripped before reaching the controller. No error is thrown — the extra fields just disappear. This prevents users from injecting unexpected fields.

**`transform: true`** — required for type coercion. URL params and query strings always arrive as strings. Without `transform`, `@Param('id')` gives you `"1"` (string) even if typed as `number`. With it, NestJS coerces automatically.

**Validation runs in the pipe — before the controller.** It's the earliest possible point in the pipeline, before the guard sandwich even starts. Bad data never reaches the controller at all.

---

### DTO Validation Decorators

```ts
// src/properties/dto/create-property.dto.ts
import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Apartments' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'TX' })
  @IsString()
  @Length(2, 2)
  state: string;
}
```

Send an empty body → **400 Bad Request** with a message listing every failing field. The controller never runs.

Send extra fields (e.g., `"hackerField": "bad"`) → silently stripped, no error, request succeeds if valid fields are present.

---

### LoginDto Validation

```ts
import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class LoginDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  tenantId: number;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @IsEnum(Role)
  role: string;
}
```

`@IsEnum(Role)` restricts `role` to only `'admin'`, `'tenant_user'`, or `'viewer'`. Sending `"role": "superadmin"` → **400 Bad Request**.

---

### Tenant Isolation on Writes — Security Rule

**tenantId must always come from the JWT, never from the request body.**

```ts
// Service — accepts tenantId as a separate parameter
async create(dto: CreatePropertyDto, tenantId: number): Promise<Property> {
  return this.prisma.property.create({
    data: {
      ...dto,      // copies name, address, city, state from the DTO
      tenantId,    // always from the JWT — not from the request body
    },
  });
}

// Controller — passes user.tenantId from the verified JWT
@Post()
create(@CurrentUser() user: JwtPayload, @Body() createPropertyDto: CreatePropertyDto) {
  return this.propertiesService.create(createPropertyDto, user.tenantId);
}
```

The JWT is server-signed — a malicious user can't forge what's inside it. Anything that comes from the client (body, params, query) can be faked. Anything from the JWT cannot. This applies to all write operations: `create`, `update`, `remove`.

---

### Complete CRUD Service Patterns

**findOne — verify ownership before returning:**
```ts
async findOne(id: number, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });
  if (!property) throw new NotFoundException(`Property ${id} not found`);
  return property;
}
```

**update — verify ownership before mutating:**
```ts
async update(id: number, dto: UpdatePropertyDto, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });
  if (!property) throw new NotFoundException(`Property ${id} not found`);
  return this.prisma.property.update({ where: { id }, data: dto });
}
```

**remove — verify ownership before deleting:**
```ts
async remove(id: number, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });
  if (!property) throw new NotFoundException(`Property ${id} not found`);
  return this.prisma.property.delete({ where: { id } });
}
```

Pattern is the same for all three: `findFirst` with both `id` AND `tenantId` → if null throw NotFoundException → then mutate. The caller never knows if a record exists but belongs to another tenant — both cases return 404.

**Every write controller method needs `@CurrentUser()` and must pass `user.tenantId` to the service:**
```ts
@Patch(':id')
update(
  @Param('id') id: string,
  @CurrentUser() user: JwtPayload,
  @Body() updatePropertyDto: UpdatePropertyDto,
) {
  return this.propertiesService.update(+id, updatePropertyDto, user.tenantId);
}
```

If the service signature changes (adds a parameter), the controller call must match — TypeScript will show a red squiggle on the call if the argument count is wrong.

---

### ROLES_KEY Bug — String Literal vs Constant

```ts
// Wrong — stores metadata under the string 'ROLES_KEY'
export const Roles = (...roles: Role[]) => SetMetadata('ROLES_KEY', roles);

// Correct — stores metadata under the constant value 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

The decorator stored metadata under `'ROLES_KEY'` (the variable name as a string literal). The guard was reading for `ROLES_KEY` (the constant, whose value is `'roles'`). They never matched — so `requiredRoles` was always `undefined` → guard always returned `true` → every role could hit every route.

This is exactly why the `ROLES_KEY` constant exists — use it in both the decorator and the guard so they always refer to the same key. One change in one place updates both.

---

### Foreign Key Constraint — Tenant Must Exist First

`Property` has a foreign key on `tenantId` referencing the `Tenant` table. You cannot create a Property for a tenantId that doesn't exist in the Tenant table — the database enforces this.

Error: `Foreign key constraint violated on the constraint: Property_tenantId_fkey`

Fix: insert a Tenant row first:
```bash
psql hpos_test_db
```
```sql
INSERT INTO "Tenant" (name) VALUES ('Test Tenant');
```

This is why in production, tenants are created through a registration flow before any of their data can be inserted.

---

### Testing Role Restrictions in Swagger

The "Authorize" button in Swagger holds one active token. To test a 403 on a role-restricted route:
1. Login with a non-admin role: `POST /auth/login` with `"role": "tenant_user"`
2. Copy that token from the response
3. Click Authorize → replace the current token with the new one
4. Try `DELETE /properties/{id}` → expect **403 Forbidden**

If you only called login with a viewer role to test the 400 validation but didn't replace the Swagger token, the DELETE still runs with the original admin token — that's why it would succeed when you expected it to fail.

---

## Wiring Prisma into NestJS (Step 6)

### nest generate service prisma
Generates two files: `prisma.service.spec.ts` (Jest test file) and `prisma.service.ts`. Also auto-updates `app.module.ts` to add PrismaService as a provider. The spec file is for testing the service logic. The service file is where I write the actual PrismaService class.

### nest generate module prisma
Creates `prisma.module.ts` and auto-updates `app.module.ts` to add PrismaModule to the imports array.

---

### prisma.service.ts — What I Did

Made `PrismaService` extend `PrismaClient` and implement `OnModuleInit` and `OnModuleDestroy`. Extending PrismaClient means PrismaService IS the client — I call `this.property.findMany()` directly instead of going through a separate instance.

`OnModuleInit` and `OnModuleDestroy` are NestJS lifecycle hooks:
- `onModuleInit` fires after all modules are loaded and providers are resolved — right before the app starts accepting traffic. This is when `$connect()` runs.
- `onModuleDestroy` fires when the app shuts down. This is when `$disconnect()` runs — closes the connection cleanly.

Without these hooks I'd have to manage the database connection myself. NestJS fires them at exactly the right moment.

---

### prisma.module.ts — providers, exports, @Global()

Three things happening here and they each mean something different:

**providers: [PrismaService]** — PrismaModule is responsible for creating and managing the PrismaService instance. It owns it. Not just the lifecycle hooks — it owns the whole thing.

**exports: [PrismaService]** — makes PrismaService available to any module that imports PrismaModule. Just adding it to providers is not enough — without exports, other modules that import PrismaModule still can't access PrismaService. Have to explicitly say "this is available to whoever imports me."

**@Global()** — import PrismaModule once in AppModule and PrismaService becomes available everywhere automatically. Without @Global(), every module that needs PrismaService would have to import PrismaModule itself.

The breakdown: `providers` = I own this. `exports` = others can use it. `@Global()` = everyone gets it without asking.

---

### app.module.ts — Common Mistake

When the CLI auto-generates, it may add PrismaService to both `AppModule.providers` AND PrismaModule already exports it. That creates two separate instances. The fix: only `PrismaModule` goes in `AppModule.imports[]`. Never add `PrismaService` to `AppModule.providers[]` when using PrismaModule.

---

## API Key Guard (Step 8)

### What a Guard Does

Guards have one job — determine whether a request will be handled by the route handler or not. This is authorization. Guards know exactly what's going to be executed next (which controller, which method) so at runtime they can decide if the request is allowed to proceed.

Certain routes are only available to callers with the right permissions. The guard checks the incoming request for proof of access — in this case an API key in the request header — and either allows it through or throws a 401.

> Docs: https://docs.nestjs.com/guards
> ExecutionContext deep dive: https://docs.nestjs.com/fundamentals/execution-context

---

### The Guard File — api-key.guard.ts

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (apiKey === 'secret') return true;
    throw new UnauthorizedException();
  }
}
```

**Breaking it down line by line:**

`implements CanActivate` — the contract this class must fulfill. Forces me to define a `canActivate` method. NestJS calls this method on every request that hits a guarded route.

`canActivate(context: ExecutionContext): boolean` — the method NestJS calls. Returns `boolean`. Can also return `Promise<boolean>` or `Observable<boolean>` if the check is async, but since checking a header is synchronous, plain `boolean` is all that's needed here.

`context.switchToHttp().getRequest()` — this is the line to memorize. Every HTTP guard will have it.
- `ExecutionContext` is NestJS's generic wrapper that works across HTTP, WebSockets, and gRPC
- `.switchToHttp()` tells it we're in an HTTP context
- `.getRequest()` returns the Express request object — everything the client sent: headers, body, params, URL, method
- The result is stored in `request` — this represents the incoming network call at the moment the user sent it

`request.headers['x-api-key']` — reads the `x-api-key` header from the incoming request. The client (curl, browser, Postman) sends this header. The guard reads it.

`if (apiKey === 'secret') return true` — if the key matches, allow the request through. `'secret'` is a hardcoded placeholder. In production this would be `process.env.API_KEY`.

`throw new UnauthorizedException()` — if the key doesn't match or is missing, NestJS catches this and returns a 401 response automatically.

---

### Docs Example vs Our Guard

The NestJS docs show a skeleton guard:
```ts
// Docs skeleton — shows the shape, no real logic
canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
  return true; // always allows everything — same as no guard at all
}
```

Ours fills in the actual logic. The three return types (`boolean | Promise<boolean> | Observable<boolean>`) show what's possible — we only need `boolean` since checking a header doesn't require async.

---

### Applying the Guard to the Controller

```ts
import { UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@UseGuards(ApiKeyGuard)       // pass the class — NestJS DI handles instantiation
@Controller('properties')
export class PropertiesController { ... }
```

`@UseGuards(ApiKeyGuard)` protects every route inside the controller. Pass the class directly — never `new ApiKeyGuard()`. NestJS handles creating the instance.

Both `@UseGuards` and `@Controller` are decorators on the class. The order between them doesn't matter — NestJS processes all class decorators.

---

## Multi-Tenant Isolation (Step 10)

### What Multi-Tenancy Means Here

Multiple property management companies (tenants) share the same database. Their data must never bleed into each other. We use row-level isolation — every table that holds tenant data gets a `tenantId` column and every query filters by it.

### What Was Added to schema.prisma

A new `Tenant` model was added and the `Property` model was updated to reference it:

```prisma
model Tenant {
  id         Int        @id @default(autoincrement())
  name       String
  createdAt  DateTime   @default(now())
  properties Property[]
}

model Property {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  ...
}
```

`tenantId` on Property is a **foreign key** — it's not original to the Property model, it references the `id` of the Tenant model. This means:
- You cannot create a Property with a `tenantId` that doesn't exist in the Tenant table — the database enforces this
- Prisma can traverse the relation — `prisma.tenant.findUnique({ include: { properties: true } })` returns a tenant and all their properties in one query

### The Migration

```bash
npx prisma migrate dev --name add-tenant
```

The generated `migration.sql` file shows the actual SQL Prisma ran — `ALTER TABLE` to add `tenantId`, `CREATE TABLE` for Tenant, and the foreign key constraint. Never edit this file — it's the historical record.

### How the Service Filters by Tenant

```ts
async findAll(tenantId: number): Promise<Property[]> {
  return this.prisma.property.findMany({
    where: { tenantId },
  });
}
```

The controller passes the tenantId (hardcoded as `1` for now — will come from JWT in Phase 2):
```ts
findAll() {
  return this.propertiesService.findAll(1);
}
```

### Proof It Works

Inserted a Tenant and a Property with `tenantId: 1` directly via psql. Then:
- Called `findAll(1)` → returned the property ✓
- Changed hardcoded value to `2` → returned `[]` ✓

Same endpoint, same database, different tenantId = completely different results. That's row-level isolation working.

### The Trade-off

- **Benefit:** Simple setup, cheap to operate, easy to migrate all tenants at once
- **Risk:** One missed `where: { tenantId }` in a query leaks data across tenants — the database won't catch it, only the app will

In production, tenantId comes from the JWT so it's always present and always validated before reaching the service. That's Phase 2.

### Cleaning Up Test Data

```sql
TRUNCATE "Property" RESTART IDENTITY CASCADE;
TRUNCATE "Tenant" RESTART IDENTITY CASCADE;
```

Deletes all rows and resets auto-increment IDs. No files touched, no migrations created — data only.

Exit psql with `\q`.

---

## LoggingInterceptor (Step 9)

### What an Interceptor Does

Interceptors wrap both sides of the request/response cycle. One request, one pass through the pipeline — the controller is NOT hit twice.

```
Request arrives
  → Guard (allow or deny — if denied, nothing below runs)
  → Interceptor wraps everything below it
      → Controller method executes (once)
      → Service runs
  → Interceptor sees the response on the way out
→ Response sent back to client
```

Think of it like a sandwich — the interceptor is the bread, the controller and service are the filling. The bread is on both sides but the filling only happens once in the middle.

The guard is completely separate and runs first. If the guard denies the request, the interceptor never runs, the controller never runs, nothing runs — 401 is returned immediately.

The interceptor doesn't re-hit the controller. It wraps the execution — runs code before the handler fires, then runs code again after the handler has already completed and the response is being built.

### What an Interceptor Can Do

- **Add logic before/after method execution** — extra logic outside of what the service handles. Our logging is the example — has nothing to do with properties business logic but runs on every request.
- **Transform the result** — intercept the response and reshape it before it goes to the client. Example: wrap every response in `{ data: ..., success: true }`.
- **Transform exceptions** — catch an error thrown by the service and reformat it before the client sees it.
- **Extend basic function behavior** — add caching, retries, timeouts without touching the service itself.
- **Override a function** — return a cached response without the handler ever running.

### The Two Arguments

`ExecutionContext` — same as guards. Gives access to the request object via `context.switchToHttp().getRequest()`.

`CallHandler` — gives access to `next.handle()` which actually executes the route handler. If `next.handle()` is never called, the handler never runs. Everything before it runs first. Everything in `tap()` runs after.

### The LoggingInterceptor

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { method, url } = context.switchToHttp().getRequest();
    const start = Date.now();

    console.log(`[${method}] ${url} — incoming`);

    return next.handle().pipe(
      tap(() => console.log(`[${method}] ${url} — ${Date.now() - start}ms`)),
    );
  }
}
```

- `{ method, url }` destructured from the request — `method` is GET/POST/etc, `url` is the path
- `Date.now()` captured before `next.handle()` = start time
- `tap()` runs after the handler completes — calculates duration, logs it
- `tap` doesn't modify the response — it just observes it (side effect only)

Applied globally in `main.ts` — every route gets it automatically:
```ts
app.useGlobalInterceptors(new LoggingInterceptor());
```

Uses `new` here because `main.ts` is outside the NestJS DI context. Same reason as always — outside DI = instantiate manually.

Terminal output on every request:
```
[GET] /properties — incoming
[GET] /properties — 5ms
```

> Docs: https://docs.nestjs.com/interceptors

---

## Testing API Endpoints

Three ways to test — all send HTTP requests, just different tools:

**curl** — terminal, fastest, full control over headers:
```bash
curl http://localhost:3000/properties                        # no header → 401
curl -H "x-api-key: secret" http://localhost:3000/properties # with header → []
curl -v -H "x-api-key: secret" http://localhost:3000/properties # verbose — shows headers sent/received
```

**Insomnia** — GUI app, good for complex requests. Add custom headers in the Headers tab. Use for POST/PATCH requests where you need to send a body.

**Thunder Client** — same as Insomnia but lives inside VS Code as an extension.

**Browser** — typing a URL directly sends a plain GET with no custom headers. Can't add `x-api-key` this way — always returns 401 with our guard. This is expected behavior, not a bug. The browser not being able to hit the route has nothing to do with the frontend not being set up — it's because there's no way to attach custom headers from the address bar.

For API key auth: always use the **Headers tab**, not the Auth/Bearer tab. Bearer token is for JWT auth (Phase 2). API key is a custom header.

---

## Setting Up Postgres

Two commands to know:

- `pg_ctl -D /opt/homebrew/var/postgresql@16 start` — starts the Postgres database server so it's listening for connections. If Postgres is already running as a background service (brew services), this isn't needed.
- `createdb hpos_test_db` — creates a new empty database with that name

TablePlus is a visual tool to see the database — like Snowflake but for local Postgres. Connect using: Host `127.0.0.1`, Port `5432`, User = Mac username, Password blank, Database = the db name. Before connecting, the Postgres role (user) has to exist — create it with:
```bash
psql postgres -c "CREATE ROLE your_username WITH SUPERUSER LOGIN;"
```

---

## What Prisma Is

Prisma lets me interact with the database using TypeScript instead of writing raw SQL. Instead of a massive SQL block to query a table, I write `prisma.property.findMany()` and Prisma generates and runs the SQL for me.

Two packages:
- `prisma` — the CLI dev tool. Manages the schema, runs migrations, generates the client. Not shipped to production.
- `@prisma/client` — the runtime client my app actually imports and uses. This goes to production.

Install with explicit v6 (v5 crashes on Node 24, v7 breaks NestJS):
```bash
npm install prisma@"^6.0.0" @prisma/client@"^6.0.0"
```

---

## What prisma init Creates

Two things:
- `prisma/schema.prisma` — where I define my data models (tables) and my database connection. This is the source of truth for the database structure.
- `.env` — where `DATABASE_URL` lives. Never commit this. Always check `.gitignore` has `.env` in it.

`DATABASE_URL` is the connection string that tells Prisma where my database is, what user to connect as, and which database to use:
```
postgresql://my_mac_username@localhost:5432/hpos_test_db
```

---

## Prisma Migrations

Running `npx prisma migrate dev --name init` does the following:
1. Reads the DATABASE_URL from `.env` to connect to Postgres
2. Loads the models from `schema.prisma`
3. Generates SQL (like `CREATE TABLE`) and saves it to `prisma/migrations/<timestamp>_init/migration.sql`
4. Applies that SQL to the database
5. Records what was run so it knows what's already been applied

This is the same thing as going into Snowflake and running `CREATE TABLE` manually — Prisma just generates and runs the SQL for me.

**The migration file should never be manually edited.** It's a historical record of what was applied to the database. If I need to change the schema, I update the model in `schema.prisma` and run `migrate dev` again — Prisma generates a new migration file for only the difference. Editing an already-applied migration causes drift between Prisma's history and what's actually in the database.

**What migrate dev also does — generates the Prisma Client.** After applying the migration, Prisma regenerates the TypeScript client based on the current schema. This is what makes `Property` available to import from `@prisma/client`. Every time the schema changes and migrate dev runs, the client is updated to reflect the new shape. If I add a field to a model, that field becomes available in TypeScript automatically after the next migration. No manual type writing needed — the types come directly from the schema.

---

## Using PrismaService in PropertiesService (Step 7)

Three things needed in `properties.service.ts`:

1. `import { PrismaService } from '../prisma/prisma.service'` — brings in the service so it can be injected
2. `constructor(private readonly prisma: PrismaService) {}` — injects it so `this.prisma` is available in every method
3. `import { Property } from '@prisma/client'` — brings in the generated TypeScript type so the return type of `findAll` is known

The `Property` type comes from the Prisma client that was generated when `prisma migrate dev` ran. It matches exactly what's in the database — every field in the schema becomes a property on the type. TypeScript uses it to catch mistakes — if I try to access a field that doesn't exist on Property, it errors at compile time, not at runtime.

`Promise<Property[]>` means: this async function returns a promise that resolves to an array of Property objects. The `[]` means array.

`this.prisma.property.findMany()` — `this.prisma` is the injected PrismaService instance. `.property` is the table. `.findMany()` returns all rows.

---

## Prisma Generator — Must Use prisma-client-js

When `prisma init` runs, it might generate the schema with `provider = "prisma-client"` and a custom output path. This breaks NestJS because it generates an ESM-incompatible client. Always fix it to:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Also delete `prisma.config.ts` if it gets generated — DATABASE_URL belongs in `schema.prisma`'s datasource block, not in a separate file.

---

## Build Order That Makes Sense

1. Define the module — declare what controllers and services exist in this scope
2. Define the controller — what routes exist, what each one does
3. Define the service — the actual logic each route calls

In practice I think about it in reverse: what data do I need? → write the service method → wire the controller to call it → register both in the module.

---

## nest generate resource — What It Creates

`nest generate resource properties` is similar to `nest new` — it creates a whole directory and structures it with files automatically. I just name it and NestJS scaffolds everything.

Files it creates:
- `properties.controller.ts` — predefined routes already configured, each referencing `this.propertiesService.x()`
- `properties.service.ts` — predefined methods: `create`, `findAll`, `findOne`, `update`, `remove`
- `properties.module.ts` — registers the controller and service for this scope
- `properties.controller.spec.ts` — Jest test file for the controller
- `properties.service.spec.ts` — Jest test file for the service
- `dto/create-property.dto.ts` — defines the shape of incoming data for create
- `dto/update-property.dto.ts` — extends CreatePropertyDto via PartialType
- `entities/property.entity.ts` — placeholder for the database row shape

The `:dev` server picks up the new files automatically and reinitializes with the new routes included — I can see them appear in the terminal output.

**Important:** always run `nest generate` commands from inside `app/` — not the curriculum root. Running it from the wrong directory generates files in the wrong place.

---

## AppModule imports Array — Why PropertiesModule Goes There

`AppModule` owns `AppController` and `AppService` in its `controllers` and `providers` arrays. The `imports` array is for modules that live outside of it — self-contained modules with their own controllers and services.

`PropertiesModule` is its own `@Module` with its own controller and service. To make it part of the app, it has to be in `AppModule.imports[]`. If it's not there, NestJS doesn't know it exists and the routes won't register.

So the pattern is: `controllers` and `providers` = things this module owns directly. `imports` = other modules being brought in from outside.

---

## AppController and AppService = The Home Route

`AppController` and `AppService` handle `/` — the root.

`PropertiesController` handles `/properties`. As more resources get added, each gets its own controller and prefix:

```
AppController        → /
PropertiesController → /properties
TenantsController    → /tenants
```

`AppController` is typically just a health check in production — a `GET /health` endpoint so infrastructure can ping it to confirm the app is alive.

---

## @Controller('properties') — The Route Prefix

The string passed to `@Controller()` defines the prefix for every route inside that controller. So `@Get()` becomes `GET /properties`, `@Get(':id')` becomes `GET /properties/:id`. NestJS uses it to know which controller owns which URL path.

---

## DTOs — Shape of Incoming Data

A DTO defines what shape of data is allowed into an operation. Right now they're empty because the fields haven't been defined yet. Once I add fields like `name`, `address`, `city`, `state` — NestJS validates that incoming request bodies match that shape before they ever reach the service.

`UpdatePropertyDto` extends `CreatePropertyDto` via `PartialType` — instead of defining the same fields twice, Update just references Create and makes every field optional. This makes sense because on an update I might only send the fields I'm changing, not all of them.

---

## entities/property.entity.ts — Placeholder

An empty class right now. It's meant to represent a database row as a TypeScript class. Once Prisma is wired in, the actual type comes from `@prisma/client` — so this file won't really be used directly.

---

## Route Order Matters

NestJS reads routes top to bottom. If a dynamic route like `:id` is defined before a specific route like `example`, a request to `/properties/example` will match `:id` first and treat `"example"` as the id value — it never reaches the specific route.

Fix: always define specific routes before dynamic ones:

```ts
@Get('example')   // specific — first
@Get(':id')       // dynamic — after
```

The rule: specific routes before `:param` routes. Always.

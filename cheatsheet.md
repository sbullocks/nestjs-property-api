# NestJS + Prisma Cheatsheet

Pure syntax reference. No explanation — use the modules for that.

---

## NestJS Decorators

```ts
// Module
@Module({ imports: [], controllers: [], providers: [], exports: [] })

// Controller
@Controller('properties')
@Get() @Get(':id') @Post() @Patch(':id') @Delete(':id')
@Param('id') @Body() @Query('key')

// Provider
@Injectable()

// Guards
@UseGuards(MyGuard)           // on controller or method — DI handles instantiation
app.useGlobalGuards(new G())  // in main.ts — outside DI, use new

// Interceptors
app.useGlobalInterceptors(new LoggingInterceptor())

// Global module
@Global()
```

---

## Module Pattern

```ts
@Module({
  imports: [OtherModule],
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService], // expose to other modules
})
export class MyModule {}
```

---

## Service + DI Pattern

```ts
@Injectable()
export class MyService {
  constructor(private readonly prisma: PrismaService) {}
}
```

---

## PrismaService

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect()
  }
  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

---

## PrismaModule (Global)

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Guard

```ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const apiKey = request.headers['x-api-key']
    if (apiKey === process.env.API_KEY) return true
    throw new UnauthorizedException()
  }
}
```

---

## Interceptor

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { method, url } = context.switchToHttp().getRequest()
    const start = Date.now()
    console.log(`[${method}] ${url} — incoming`)
    return next
      .handle()
      .pipe(
        tap(() => console.log(`[${method}] ${url} — ${Date.now() - start}ms`)),
      )
  }
}
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Property {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  address   String
  city      String
  state     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model Tenant {
  id         Int        @id @default(autoincrement())
  name       String
  createdAt  DateTime   @default(now())
  properties Property[]
}
```

---

## Prisma Queries

```ts
// All
prisma.property.findMany()

// Filtered
prisma.property.findMany({ where: { tenantId: 1 } })

// With related data (avoids N+1)
prisma.property.findMany({ include: { tenant: true } })

// Selected fields only
prisma.property.findMany({
  where: { tenantId: 1 },
  select: { id: true, name: true, city: true },
})

// One by PK
prisma.property.findUnique({ where: { id: 1 } })

// Create
prisma.property.create({ data: { name: '...', tenantId: 1, ... } })

// Update
prisma.property.update({ where: { id: 1 }, data: { name: '...' } })

// Delete
prisma.property.delete({ where: { id: 1 } })
```

---

## Prisma CLI

```bash
npm install prisma@5 @prisma/client@5
npx prisma init
npx prisma migrate dev --name <name>
npx prisma migrate deploy          # production
npx prisma generate
```

---

## Postgres (Homebrew)

```bash
pg_ctl -D /opt/homebrew/var/postgresql@16 start
pg_ctl -D /opt/homebrew/var/postgresql@16 stop
createdb hpos_test_db
psql hpos_test_db
```

```sql
\l | \c <db> | \dt | \d "Table" | \q
EXPLAIN ANALYZE SELECT * FROM "Property" WHERE "tenantId" = 1;
```

---

## NestJS CLI

```bash
nest new <project>
nest generate resource <name>
nest generate service <name>
nest generate module <name>
nest generate guard <path/name>
nest generate interceptor <path/name>
```

---

## curl

```bash
curl http://localhost:3000/properties
curl -H "x-api-key: secret" http://localhost:3000/properties
curl -v -H "x-api-key: secret" http://localhost:3000/properties   # verbose — shows headers
curl -X POST -H "Content-Type: application/json" -H "x-api-key: secret" \
  -d '{"name":"Test"}' http://localhost:3000/properties
```

---

## Phase 2 — JWT + RBAC + Swagger

### JWT Auth Setup
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger
npm install --save-dev @types/passport-jwt
```

### JWT Payload Interface
```ts
export interface JwtPayload {
  sub: number;
  tenantId: number;
  role: string;
}
```

### JWT Strategy
```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }
  async validate(payload: JwtPayload) { return payload; }
}
```

### AuthModule
```ts
@Module({
  imports: [
    PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

### AuthService Login
```ts
async login(tenantId: number, role: string) {
  const payload: JwtPayload = { sub: tenantId, tenantId, role };
  return { access_token: this.jwtService.sign(payload) };
}
```

### JwtAuthGuard
```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### Role Enum
```ts
export enum Role { Admin = 'admin', TenantUser = 'tenant_user', Viewer = 'viewer' }
```

### @Roles() Decorator
```ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### RolesGuard
```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const user: JwtPayload = context.switchToHttp().getRequest().user;
    return requiredRoles.some((role) => user.role === role);
  }
}
```

### @CurrentUser() Decorator
```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

### Applying Guards
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.propertiesService.findAll(user.tenantId);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) { ... }
}
```

### Swagger Setup (main.ts)
```ts
const config = new DocumentBuilder()
  .setTitle('HPOS API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
```

### Swagger Decorators
```ts
@ApiTags('properties')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get all properties' })
@ApiResponse({ status: 200 })
@ApiProperty({ example: 'Sunset Apartments' })
```

### Test JWT Flow
```bash
# Get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId": 1, "role": "admin"}'

# Use token
curl -H "Authorization: Bearer <token>" http://localhost:3000/properties
```

---

## tsconfig (NestJS + Prisma v5)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2021",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

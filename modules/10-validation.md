# Module 10: Validation

Without validation, any data can enter the system — empty strings, negative IDs, missing required fields. A single missing `@IsNotEmpty()` and a blank property name ends up in the database. Validation is the gate between the network and your business logic.

NestJS uses two libraries together:
- `class-validator` — decorators that define what valid data looks like
- `class-transformer` — converts plain JSON objects into typed class instances so the decorators can run

---

## 10.1 Setup

```bash
npm install class-validator class-transformer
```

Enable the `ValidationPipe` globally in `main.ts` so every route gets it automatically:

```ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,    // strip fields not in the DTO — ignores extra properties
      forbidNonWhitelisted: false,  // don't error on extra fields, just strip them
      transform: true,    // auto-convert incoming JSON to the DTO class instance
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
```

`whitelist: true` is a security feature — if someone sends extra fields not in the DTO, they're silently stripped before reaching the controller. Without this, extra fields pass through.

`transform: true` is required for type coercion — query params always arrive as strings. Without this, `@Param('id')` gives you `"1"` (string), not `1` (number), even if you typed it as `number`.

---

## 10.2 Decorating DTOs

Add validation decorators to each field in the DTO:

```ts
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
  @Length(2, 2)   // state abbreviations are exactly 2 characters
  state: string;
}
```

When a request comes in with invalid data, NestJS automatically returns a **400 Bad Request** with a message describing which fields failed and why — before the controller method ever runs.

---

## 10.3 Common Validators

```ts
@IsString()           // must be a string
@IsNumber()           // must be a number
@IsInt()              // must be an integer
@IsBoolean()          // must be boolean
@IsEmail()            // must be a valid email format
@IsNotEmpty()         // must not be empty string, null, or undefined
@IsOptional()         // field is optional — skip validation if not present
@Min(1)               // number must be >= 1
@Max(100)             // number must be <= 100
@Length(2, 50)        // string length between 2 and 50 characters
@MinLength(3)         // string must be at least 3 chars
@MaxLength(100)       // string must be at most 100 chars
@IsEnum(Role)         // must be a value from the Role enum
```

---

## 10.4 UpdatePropertyDto — PartialType Handles Optional

`UpdatePropertyDto` extends `CreatePropertyDto` via `PartialType`. This automatically makes every field optional — you only send what you're changing. The validation decorators are inherited but only run on fields that are present.

```ts
import { PartialType } from '@nestjs/swagger';  // use @nestjs/swagger not @nestjs/mapped-types
import { CreatePropertyDto } from './create-property.dto';

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
```

Use `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) so the Swagger docs also reflect the optional fields correctly.

---

## 10.5 Tenant Isolation on Writes — Security Critical

On `POST /properties`, `tenantId` must come from the JWT — not the request body.

```ts
// WRONG — security vulnerability: user can create a property for any tenant
@Post()
create(@Body() body: CreatePropertyDto) {
  return this.propertiesService.create(body, body.tenantId); // tenantId from body = dangerous
}

// CORRECT — tenantId always comes from the verified JWT
@Post()
create(@CurrentUser() user: JwtPayload, @Body() body: CreatePropertyDto) {
  return this.propertiesService.create(body, user.tenantId); // tenantId from JWT = safe
}
```

If tenantId came from the body, a malicious user could send `"tenantId": 2` and create resources under a different tenant's account. The JWT is server-signed and tamper-proof — `user.tenantId` is always the real, verified tenant.

> **Docs:** https://docs.nestjs.com/techniques/validation

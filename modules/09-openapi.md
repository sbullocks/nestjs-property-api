# Module 9: OpenAPI / Swagger

OpenAPI is a standard for documenting REST APIs. Swagger is the UI that renders that documentation. NestJS generates both automatically from decorators — you don't write the docs manually.

---

## 9.1 What It Gives You

Once set up, visiting `http://localhost:3000/api` gives you a full interactive API explorer:
- Every route listed with its method and path
- Request body shape for POST/PATCH
- Response shape
- Auth requirements
- A "Try it out" button to test endpoints directly in the browser

This is what you share with frontend developers, QA, or clients instead of writing a separate API doc.

---

## 9.2 Setup

```bash
npm install @nestjs/swagger
```

In `main.ts`:

```ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('HPOS API')
    .setDescription('Property management API')
    .setVersion('1.0')
    .addBearerAuth()  // adds JWT auth to the UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
```

Visit `http://localhost:3000/api` — docs are live.

---

## 9.3 Decorating DTOs

NestJS reads DTO properties to build the request body schema. Add `@ApiProperty()` to each field:

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

Without `@ApiProperty()`, Swagger doesn't know what fields exist — the request body will show as empty in the UI.

---

## 9.4 Decorating Controllers

Add metadata to your routes so the docs are descriptive:

```ts
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('properties')         // groups routes under "properties" in the UI
@ApiBearerAuth()               // shows the padlock icon — route requires JWT
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {

  @ApiOperation({ summary: 'Get all properties for the current tenant' })
  @ApiResponse({ status: 200, description: 'Returns array of properties' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.propertiesService.findAll(user.tenantId);
  }
}
```

---

## 9.5 Common Swagger Decorators

| Decorator | Where | What it does |
|---|---|---|
| `@ApiTags('name')` | Controller | Groups routes in the UI |
| `@ApiBearerAuth()` | Controller | Shows JWT required |
| `@ApiOperation({ summary })` | Method | Labels the route |
| `@ApiResponse({ status, description })` | Method | Documents response codes |
| `@ApiProperty({ example })` | DTO field | Documents request body field |
| `@ApiPropertyOptional()` | DTO field | Same but marks as optional |

---

## 9.6 Why This Matters for PropertyCo

A real production API has documentation. Frontend developers need to know what endpoints exist, what they expect, and what they return. Swagger auto-generated from decorators means the docs are always in sync with the code — you can't forget to update them because they're generated from the code itself.

> **Docs:** https://docs.nestjs.com/openapi/introduction

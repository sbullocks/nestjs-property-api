# Module 11: Error Handling

Without proper error handling, a request for a non-existent property returns a 500 (server crash) instead of a 404 (not found). The client has no idea what happened. Production APIs return meaningful error responses — not stack traces.

---

## 11.1 Built-in HTTP Exceptions

NestJS ships with exception classes that map directly to HTTP status codes. Throw them from any service or controller — NestJS catches them and returns the correct response automatically.

```ts
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

throw new NotFoundException('Property not found');
// → 404 { "statusCode": 404, "message": "Property not found", "error": "Not Found" }

throw new ForbiddenException('You cannot access this resource');
// → 403

throw new BadRequestException('Invalid input');
// → 400
```

Common ones:

| Exception | Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `InternalServerErrorException` | 500 |

---

## 11.2 NotFoundException in Service Methods

The service is the right place to throw — it knows what exists in the database.

```ts
async findOne(id: number, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },   // tenant isolation enforced here too
  });

  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }

  return property;
}
```

`findFirst` instead of `findUnique` here — because we're filtering by both `id` AND `tenantId`. `findUnique` can only filter by unique fields (just `id`), and we need to ensure the property belongs to this tenant.

Same pattern for `update` and `remove` — always verify the record exists and belongs to the right tenant before modifying or deleting it.

---

## 11.3 Tenant Isolation on Update and Delete

Never update or delete by `id` alone. A user with tenantId 1 could send `DELETE /properties/5` where property 5 belongs to tenant 2. Always scope the lookup by tenantId:

```ts
async remove(id: number, tenantId: number): Promise<Property> {
  // First verify the property exists and belongs to this tenant
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });

  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }

  return this.prisma.property.delete({ where: { id } });
}
```

If the property exists but belongs to a different tenant, `findFirst` returns null → NotFoundException → the delete never runs. The caller never knows the property exists at all — which is correct behavior. Don't leak information about other tenants' data.

---

## 11.4 Global Exception Filter (Optional — Advanced)

NestJS's built-in exception layer handles `HttpException` subclasses automatically. For full control over the response shape (e.g., wrapping all errors in a consistent format), you can write a custom `ExceptionFilter`:

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

Wire globally:
```ts
app.useGlobalFilters(new HttpExceptionFilter());
```

Phase 3 doesn't require a custom filter — the built-in behavior is sufficient for now.

> **Docs:** https://docs.nestjs.com/exception-filters

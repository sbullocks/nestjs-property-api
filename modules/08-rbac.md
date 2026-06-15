# Module 8: Role-Based Access Control (RBAC)

RBAC means different users have different permissions. An admin can do everything. A tenant user can only see their own data. A viewer can only read. Guards enforce this at the route level.

---

## 8.1 The Pattern

```
JWT contains role → @Roles('admin') decorator marks the route → RolesGuard reads both → allow or deny
```

Three pieces work together:
1. **Role enum** — defines the valid roles
2. **@Roles() decorator** — marks which roles can access a route
3. **RolesGuard** — reads the role from the JWT and compares to the required roles

---

## 8.2 Role Enum

```ts
// src/common/enums/role.enum.ts
export enum Role {
  Admin = 'admin',
  TenantUser = 'tenant_user',
  Viewer = 'viewer',
}
```

Using an enum instead of raw strings means TypeScript catches typos at compile time and refactoring is easy.

---

## 8.3 @Roles() Custom Decorator

Custom decorators attach metadata to a route handler. The `RolesGuard` reads this metadata to know which roles are required:

```ts
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`SetMetadata` attaches data to the handler. `Roles('admin')` is shorthand for "attach `{ roles: ['admin'] }` as metadata to this handler."

Usage:
```ts
@Roles(Role.Admin)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

---

## 8.4 RolesGuard

Reads the required roles from the handler metadata, then checks the user's role from the JWT:

```ts
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true; // no @Roles() = open to all authenticated users

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    return requiredRoles.some((role) => user.role === role);
  }
}
```

`Reflector` is NestJS's tool for reading metadata attached by decorators. `getAllAndOverride` reads the `roles` metadata from the handler first, then the class — handler-level overrides class-level.

---

## 8.5 Applying Both Guards

JwtAuthGuard runs first (verifies the token). RolesGuard runs second (checks the role):

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.propertiesService.findAll(user.tenantId);
  }

  @Roles(Role.Admin)   // only admins can delete
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(+id);
  }
}
```

Routes without `@Roles()` are accessible to any authenticated user. Routes with `@Roles()` are restricted to those specific roles.

---

## 8.6 @CurrentUser() Custom Decorator

Instead of `@Req() req` and `req.user` everywhere, create a clean decorator:

```ts
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Usage is clean:
```ts
@Get()
findAll(@CurrentUser() user: JwtPayload) {
  return this.propertiesService.findAll(user.tenantId);
}
```

This is the pattern used in production NestJS apps. Much cleaner than `req.user` everywhere.

> **Docs:** https://docs.nestjs.com/security/authorization  
> **Docs:** https://docs.nestjs.com/custom-decorators

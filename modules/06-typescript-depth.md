# Module 6: TypeScript Depth

You've been writing TypeScript since Phase 1. This module goes deeper on the patterns that show up constantly in NestJS — generics, utility types, decorators, and interfaces. These are what separate "TypeScript that works" from "TypeScript that's actually typed."

---

## 6.1 Generics

A generic is a placeholder type — it lets you write code that works with any type while still being fully typed.

You've already used generics without realizing it:

```ts
Promise<Property[]>   // Promise that resolves to an array of Property
findMany(): Property[] // returns an array of Property
```

The `<T>` syntax is the generic parameter:

```ts
// Without generic — loses type info
function getFirst(arr: any[]): any {
  return arr[0];
}

// With generic — TypeScript knows the return type matches the input
function getFirst<T>(arr: T[]): T {
  return arr[0];
}

const first = getFirst([1, 2, 3]);    // TypeScript knows first is number
const name = getFirst(['a', 'b']);    // TypeScript knows name is string
```

In NestJS you'll see generics on responses, repositories, and services:

```ts
async findOne(id: number): Promise<Property | null> {
  return this.prisma.property.findUnique({ where: { id } });
}
```

---

## 6.2 Utility Types

Utility types are built-in TypeScript helpers that transform existing types. You've seen `Partial<T>` in `UpdatePropertyDto` — here's the full set you'll use:

**`Partial<T>`** — makes all fields optional:
```ts
type UpdateProperty = Partial<Property>;
// all fields optional — use for PATCH operations
```

**`Pick<T, K>`** — keep only specific fields:
```ts
type PropertySummary = Pick<Property, 'id' | 'name' | 'city'>;
// only id, name, city — use for list views
```

**`Omit<T, K>`** — remove specific fields:
```ts
type PropertyWithoutDates = Omit<Property, 'createdAt' | 'updatedAt'>;
// everything except timestamps
```

**`Record<K, V>`** — creates an object type with specific key/value types:
```ts
type RolePermissions = Record<string, string[]>;
// { admin: ['read', 'write'], viewer: ['read'] }
```

**`Required<T>`** — opposite of Partial, makes all fields required:
```ts
type FullProperty = Required<Partial<Property>>;
```

---

## 6.3 Interfaces vs Types

Both define object shapes. In NestJS codebases you'll see both:

```ts
// Interface — extendable, good for object shapes and contracts
interface JwtPayload {
  sub: number;      // user/tenant id
  role: string;
  iat?: number;     // issued at
  exp?: number;     // expiry
}

// Type — more flexible, can use unions and intersections
type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
}
```

**Rule of thumb:** Use `interface` for object shapes that might be extended. Use `type` for unions, intersections, or when you need more flexibility.

---

## 6.4 Decorators — How They Actually Work

You've used decorators everywhere (`@Injectable()`, `@Controller()`, `@Get()`). Now understand what they are.

A decorator is a function that wraps a class, method, or property and adds behavior:

```ts
// This decorator:
@Injectable()
export class PropertiesService {}

// Is equivalent to:
export class PropertiesService {}
Injectable()(PropertiesService); // Injectable() returns a function that receives the class
```

NestJS decorators do things like:
- Mark a class as injectable into the DI container
- Register metadata on a class or method that NestJS reads at runtime
- Attach guards, interceptors, or pipes to a route

You can create custom decorators — Phase 2 uses this for `@Roles()` and `@CurrentUser()`.

**Custom parameter decorator:**
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // attached by JWT strategy
  },
);

// Usage in controller:
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  return user;
}
```

---

## 6.5 Type Inference

TypeScript can figure out types without you explicitly declaring them:

```ts
// You don't need to declare the return type — TypeScript infers it
const name = 'Stephen';           // inferred as string
const id = 42;                    // inferred as number
const property = await prisma.property.findUnique({ where: { id: 1 } });
// inferred as Property | null
```

When to annotate explicitly vs let TypeScript infer:
- **Function return types** — annotate explicitly so callers know what to expect
- **Variables** — let TypeScript infer unless the type is ambiguous
- **Parameters** — always annotate

```ts
// Annotate return type — makes the contract clear
async findAll(tenantId: number): Promise<Property[]> {
  return this.prisma.property.findMany({ where: { tenantId } });
}
```

---

## 6.6 Enums

Use enums for fixed sets of values — like user roles:

```ts
export enum Role {
  Admin = 'admin',
  TenantUser = 'tenant_user',
  Viewer = 'viewer',
}

// Usage:
if (user.role === Role.Admin) { ... }
```

Enums make roles explicit and refactor-safe — changing `'admin'` everywhere at once is just changing the enum value.

> **Docs:** https://www.typescriptlang.org/docs/handbook/2/types-from-types.html

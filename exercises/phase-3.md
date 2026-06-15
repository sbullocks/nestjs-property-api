# Phase 3: Validation + Complete CRUD + Error Handling

Starting point: Phase 2 complete — JWT auth, RBAC, and Swagger all working. The API has stub service methods (`create`, `update`, `remove`, `findOne`) that return placeholder strings instead of real database operations.

Goal: Replace all stubs with real Prisma operations, add input validation to every DTO, and return proper HTTP errors instead of crashing with 500s.

Difficulty: 3/5

---

## Step 1: Install validation libraries

From inside `app/`:

```bash
npm install class-validator class-transformer
```

**Understand:** What does `class-validator` do? What does `class-transformer` do? Why do you need both?

---

## Step 2: Enable ValidationPipe globally

In `main.ts`, add the global validation pipe before `app.listen()`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
  }),
);
```

See Module 10 for what each option does and why `whitelist: true` is a security feature.

**Commit:**
```bash
git add .
git commit -m "chore: install class-validator and enable global ValidationPipe"
```

---

## Step 3: Add validation to CreatePropertyDto

Open `src/properties/dto/create-property.dto.ts`. Add `@IsString()`, `@IsNotEmpty()`, and any other appropriate validators to each field. Keep `@ApiProperty()` decorators — add the validation decorators alongside them.

See Module 10 for the full list of decorators.

Test: Send a POST to `/properties` with an empty body in Swagger. Expected: **400 Bad Request** with a message listing which fields failed.

---

## Step 4: Add validation to LoginDto

Open `src/auth/dto/login.dto.ts`. Add `@IsNumber()` to `tenantId` and `@IsString()` + `@IsNotEmpty()` to `role`. Add `@IsEnum(Role)` to restrict `role` to valid values.

Test: Send a POST to `/auth/login` with `"role": "superadmin"` (not a valid role). Expected: **400 Bad Request**.

---

## Step 5: Implement create()

In `src/properties/properties.service.ts`, replace the stub `create()` with a real Prisma insert. The method signature needs to accept `tenantId` separately — it comes from the JWT, not the DTO.

```ts
async create(dto: CreatePropertyDto, tenantId: number): Promise<Property> {
  return this.prisma.property.create({
    data: {
      ...dto,
      tenantId,
    },
  });
}
```

**Security:** `tenantId` must not come from the DTO body — it must come from the JWT. See Module 10 section 10.5 for why this matters.

Update the controller's `create()` to pass it:
```ts
@Post()
create(@CurrentUser() user: JwtPayload, @Body() createPropertyDto: CreatePropertyDto) {
  return this.propertiesService.create(createPropertyDto, user.tenantId);
}
```

Test: POST a property with valid fields in Swagger. Expected: **201** with the created property object.

**Commit:**
```bash
git add .
git commit -m "feat: implement property create with tenant isolation"
```

---

## Step 6: Implement findOne()

In the service, replace the stub `findOne()`. Use `findFirst` (not `findUnique`) because you're filtering by both `id` AND `tenantId`:

```ts
async findOne(id: number, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });

  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }

  return property;
}
```

Update the controller to pass `user.tenantId`:
```ts
@Get(':id')
findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  return this.propertiesService.findOne(+id, user.tenantId);
}
```

**Understand:** Why `findFirst` instead of `findUnique`? What happens if you request a property that belongs to a different tenant?

Test:
- `GET /properties/1` → should return the property if it belongs to the current tenant
- `GET /properties/999` → should return **404 Not Found**

---

## Step 7: Implement update()

In the service, verify the property exists and belongs to this tenant before updating:

```ts
async update(id: number, dto: UpdatePropertyDto, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });

  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }

  return this.prisma.property.update({
    where: { id },
    data: dto,
  });
}
```

Update the controller:
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

Test:
- PATCH `/properties/1` with `{ "name": "Updated Name" }` → should return the updated property
- PATCH `/properties/999` → should return **404**

---

## Step 8: Implement remove()

Same pattern — verify ownership before deleting:

```ts
async remove(id: number, tenantId: number): Promise<Property> {
  const property = await this.prisma.property.findFirst({
    where: { id, tenantId },
  });

  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }

  return this.prisma.property.delete({ where: { id } });
}
```

Update the controller:
```ts
@Roles(Role.Admin)
@Delete(':id')
remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  return this.propertiesService.remove(+id, user.tenantId);
}
```

Test:
- DELETE `/properties/1` with Admin token → should return the deleted property
- DELETE `/properties/1` again → should return **404** (already deleted)
- DELETE with Viewer token → should return **403 Forbidden**

**Commit:**
```bash
git add .
git commit -m "feat: implement complete CRUD with tenant isolation and error handling"
```

---

## Step 9: End-to-end test via Swagger

Full flow test:

1. `POST /auth/login` → get a token (role: admin, tenantId: 1)
2. Click Authorize → paste token
3. `POST /properties` → create a property (check 201, inspect response for id)
4. `GET /properties` → should return the new property
5. `GET /properties/{id}` → should return just that property
6. `PATCH /properties/{id}` → update the name, check the response
7. `GET /properties/{id}` → confirm the name changed
8. `DELETE /properties/{id}` → delete it
9. `GET /properties` → should be empty again

Then test error cases:
- `POST /properties` with empty body → 400 with validation errors
- `GET /properties/999` → 404
- Login with `"role": "superadmin"` → 400 (invalid enum)
- Get a viewer token, try DELETE → 403

**Commit:**
```bash
git add .
git commit -m "test: verify complete CRUD and validation end-to-end"
```

---

## Phase 3 Complete

You've added:
- Input validation on all DTOs — bad data is rejected at the boundary
- Tenant isolation enforced on all write operations — tenantId always from JWT
- Real Prisma CRUD replacing all scaffold stubs
- NotFoundException on missing records — 404 instead of 500
- Full end-to-end tested via Swagger

**Practice:** Redo Phase 3 from scratch using only cheatsheet and my-notes. When you can complete Phase 1 + 2 + 3 back to back without references, you're ready for Phase 4.

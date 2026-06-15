# Phase 5: Testing with Jest

Starting point: Phase 4 complete — full CRUD with JWT auth, RBAC, validation, pagination, and filtering.

Goal: Write unit tests for the service layer (with mocked Prisma) and e2e tests for the HTTP layer (full stack). Understand what each type of test is actually verifying.

Difficulty: 4/5

---

## Step 1: Understand what's already there

The scaffold already created spec files. Open them:

```
app/src/properties/properties.service.spec.ts
app/src/properties/properties.controller.spec.ts
app/src/auth/auth.service.spec.ts
```

Run the existing tests:
```bash
cd app && npm run test
```

They'll likely pass (they test almost nothing by default) or fail with import errors. Either way — read what's in them before replacing them.

---

## Step 2: Write unit tests for PropertiesService

Replace `properties.service.spec.ts` with real tests. Set up a mock for PrismaService:

```ts
const mockPrismaService = {
  property: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};
```

Wire it into a test module:
```ts
const module = await Test.createTestingModule({
  providers: [
    PropertiesService,
    { provide: PrismaService, useValue: mockPrismaService },
  ],
}).compile();
```

Write tests for each service method. For each test:
1. Tell the mock what to return (`mockResolvedValue`)
2. Call the service method
3. Assert the result (`expect`)

**Tests to write:**

`findAll`:
- Returns `data` and `meta` when properties exist
- Returns empty `data` and `total: 0` when no properties match

`findOne`:
- Returns the property when found
- Throws `NotFoundException` when `findFirst` returns null

`create`:
- Calls `prisma.property.create` with the correct data including `tenantId`

`update`:
- Throws `NotFoundException` when property not found
- Returns updated property when found

`remove`:
- Throws `NotFoundException` when property not found
- Returns deleted property when found

**Understand:** Why do we mock Prisma instead of using the real database? What would happen if we didn't?

---

## Step 3: Write unit tests for AuthService

Replace `auth.service.spec.ts`. Mock `JwtService`:

```ts
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};
```

Write tests for `login`:
- Returns an `access_token` string
- The token comes from `jwtService.sign`
- The payload includes `sub`, `tenantId`, and `role`

Verify `jwtService.sign` was called with the right payload:
```ts
expect(mockJwtService.sign).toHaveBeenCalledWith({
  sub: 1,
  tenantId: 1,
  role: 'admin',
});
```

---

## Step 4: Write unit tests for RolesGuard

Create `src/common/guards/roles.guard.spec.ts`. The guard has no async dependencies so no module setup needed — instantiate directly:

```ts
let guard: RolesGuard;
let reflector: Reflector;

beforeEach(() => {
  reflector = new Reflector();
  guard = new RolesGuard(reflector);
});
```

You'll need a mock `ExecutionContext`. Create a helper:
```ts
const createMockContext = (role: string) => ({
  getHandler: () => ({}),
  getClass: () => ({}),
  switchToHttp: () => ({
    getRequest: () => ({ user: { role } }),
  }),
});
```

**Tests to write:**
- Returns `true` when no `@Roles()` metadata is set (open route)
- Returns `true` when user role matches required role
- Returns `false` when user role does not match required role
- Returns `true` when user has one of multiple required roles

**Understand:** You're testing the guard's logic directly without HTTP — that's the point of a unit test.

---

## Step 5: Set up e2e testing

Open `app/test/app.e2e-spec.ts`. This is where e2e tests live.

E2e tests need a test database so they don't touch your real data. Create `app/.env.test`:
```
DATABASE_URL="postgresql://your_username@localhost:5432/hpos_test_db_e2e"
JWT_SECRET=test-secret
```

Create the test database:
```bash
createdb hpos_test_db_e2e
```

Run migrations against the test database:
```bash
DATABASE_URL="postgresql://your_username@localhost:5432/hpos_test_db_e2e" npx prisma migrate deploy
```

---

## Step 6: Write e2e tests

Replace `app.e2e-spec.ts` with real tests. Boot the full app:

```ts
beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
});

afterAll(async () => {
  await app.close();
});
```

**Tests to write:**

Auth:
- `POST /auth/login` with valid body → 201 with `access_token`
- `POST /auth/login` with invalid role → 400

Properties (unauthenticated):
- `GET /properties` without token → 401
- `POST /properties` without token → 401

Properties (authenticated):
- `GET /properties` with admin token → 200 with `data` and `meta`
- `POST /properties` with valid body → 201 with created property
- `GET /properties/:id` with valid id → 200
- `GET /properties/:id` with invalid id → 404
- `DELETE /properties/:id` with viewer token → 403
- `DELETE /properties/:id` with admin token → 200

Run e2e tests:
```bash
npm run test:e2e
```

**Commit:**
```bash
git add .
git commit -m "test: add unit tests for service, guard, and e2e tests for properties"
```

---

## Step 7: Check coverage

```bash
npm run test:cov
```

This generates a coverage report showing which lines of code are tested. Look at:
- `properties.service.ts` — aim for 80%+ coverage
- `auth.service.ts` — should be close to 100% (simple)
- `roles.guard.ts` — should be 100%

Lines highlighted in red are untested. They're not necessarily bad — some paths are legitimately hard to test — but low coverage on core service methods is a signal.

---

## Phase 5 Complete

You've added:
- Unit tests for `PropertiesService` with mocked Prisma — each method tested in isolation
- Unit tests for `AuthService` verifying JWT payload construction
- Unit tests for `RolesGuard` covering all role combinations
- E2e tests covering the full HTTP stack — auth, guards, validation, and CRUD
- Coverage reporting to identify untested paths

**Practice:** Add a test that verifies tenant isolation — create two properties with different tenantIds and confirm each token only returns its own data.

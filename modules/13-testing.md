# Module 13: Testing with Jest

Testing verifies that code does what it claims. Without tests, every change to the codebase is a potential regression — something that worked before might silently break. NestJS ships with Jest configured out of the box.

---

## 13.1 Two Types of Tests

**Unit tests** — test one piece of code in isolation. Dependencies (like Prisma, JwtService) are replaced with mocks so the test only verifies the logic in that one unit. Fast, no database needed.

**End-to-end (e2e) tests** — spin up the full NestJS application and send real HTTP requests. Tests the entire stack from request to response including guards, pipes, and the actual database. Slower but catches integration issues unit tests miss.

---

## 13.2 Test File Structure

When NestJS scaffolds a module, it creates `.spec.ts` files alongside the source files:

```
properties.service.ts
properties.service.spec.ts   ← unit test for the service
properties.controller.ts
properties.controller.spec.ts ← unit test for the controller
```

E2e tests live in a separate directory:
```
test/
  app.e2e-spec.ts   ← default e2e test file
```

Run tests:
```bash
npm run test           # unit tests (watch mode off)
npm run test:watch     # unit tests in watch mode — reruns on file save
npm run test:e2e       # e2e tests
npm run test:cov       # unit tests with coverage report
```

---

## 13.3 Anatomy of a Unit Test

```ts
describe('PropertiesService', () => {       // group of related tests
  let service: PropertiesService;
  let prisma: PrismaService;

  beforeEach(async () => {                  // runs before each test — fresh setup
    const module = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,       // mock replaces real Prisma
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  it('should return properties for a tenant', async () => {   // one test case
    const result = await service.findAll(1, {});
    expect(result.data).toHaveLength(2);
  });
});
```

`describe` groups related tests. `it` (or `test`) is a single test case. `expect` makes assertions. `beforeEach` resets state before every test so tests don't leak state into each other.

---

## 13.4 Mocking Prisma

Prisma talks to a real database. Unit tests don't want a real database — they want predictable, fast, controlled responses. Replace Prisma with a mock object:

```ts
const mockPrismaService = {
  property: {
    findMany: jest.fn(),    // jest.fn() creates a fake function you can control
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};
```

Then in each test, tell the mock what to return:
```ts
mockPrismaService.property.findMany.mockResolvedValue([
  { id: 1, name: 'Sunset Apartments', tenantId: 1, ... },
  { id: 2, name: 'River Walk', tenantId: 1, ... },
]);
mockPrismaService.property.count.mockResolvedValue(2);
```

`mockResolvedValue` is for async functions that return a promise. `mockReturnValue` is for synchronous functions.

---

## 13.5 Testing Error Cases

```ts
it('should throw NotFoundException when property not found', async () => {
  mockPrismaService.property.findFirst.mockResolvedValue(null);

  await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
});
```

`rejects.toThrow` tests that a promise rejects with a specific error. This verifies your `if (!property) throw new NotFoundException()` logic is working.

---

## 13.6 Testing Guards

Guards can be unit tested by calling `canActivate` directly:

```ts
describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(new Reflector());
  });

  it('should return true when no roles required', () => {
    const context = createMockExecutionContext({ role: 'viewer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return false when role does not match', () => {
    // set required roles metadata to ['admin']
    // set request.user.role to 'viewer'
    expect(guard.canActivate(context)).toBe(false);
  });
});
```

---

## 13.7 E2e Tests

E2e tests boot the full application and send HTTP requests with `supertest`:

```ts
import * as request from 'supertest';

describe('PropertiesController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],  // the real AppModule — full stack
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // get a real JWT token
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: 1, role: 'admin' });
    token = res.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /properties returns 401 without token', () => {
    return request(app.getHttpServer())
      .get('/properties')
      .expect(401);
  });

  it('GET /properties returns 200 with valid token', () => {
    return request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

E2e tests use a real test database — configure a separate `DATABASE_URL` in a `.env.test` file so tests don't touch production data.

> **Docs:** https://docs.nestjs.com/fundamentals/testing

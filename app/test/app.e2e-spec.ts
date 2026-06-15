import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// E2E TESTS
//
// These tests boot the FULL NestJS application and send real HTTP requests.
// Unlike unit tests that mock Prisma, e2e tests hit a real database.
//
// Requirements before running:
//   1. Create the test database:  createdb hpos_test_db_e2e
//   2. Run migrations against it:
//      DATABASE_URL="postgresql://sbullocks@localhost:5432/hpos_test_db_e2e" \
//      npx prisma migrate deploy
//   3. Run:  npm run test:e2e
//
// The app reads DATABASE_URL and JWT_SECRET from .env.test (loaded by setup-env.ts).
// ---------------------------------------------------------------------------

describe('HPOS API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let viewerToken: string;
  let tenantId: number;
  let createdPropertyId: number;

  // -------------------------------------------------------------------------
  // SETUP — runs ONCE before all tests in this file
  // beforeAll (not beforeEach) so we only boot the app once — much faster.
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror the ValidationPipe setup from main.ts — guards and pipes must
    // match production config or tests won't reflect real behavior.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();

    // Get PrismaService from the app's DI container for test setup/teardown.
    // app.get() pulls any provider out of the running app by its class.
    prisma = app.get(PrismaService);

    // Clean the test database before the suite runs so leftover data
    // from a previous run doesn't affect results.
    await prisma.property.deleteMany();
    await prisma.tenant.deleteMany();

    // Create a tenant — required because Property has a FK on tenantId.
    // Any property we create must reference a valid Tenant row.
    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Test Tenant' },
    });
    tenantId = tenant.id;

    // Get an admin token — used for routes that require authentication.
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, role: 'admin' });
    adminToken = adminRes.body.access_token;

    // Get a viewer token — used to test 403 on admin-only routes.
    const viewerRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, role: 'viewer' });
    viewerToken = viewerRes.body.access_token;
  });

  // -------------------------------------------------------------------------
  // TEARDOWN — runs ONCE after all tests complete
  // -------------------------------------------------------------------------
  afterAll(async () => {
    await prisma.property.deleteMany();
    await prisma.tenant.deleteMany();
    await app.close();
  });

  // =========================================================================
  // AUTH
  // =========================================================================
  describe('/auth/login (POST)', () => {
    it('should return 201 and an access_token with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ tenantId: 1, role: 'admin' })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
    });

    it('should return 400 when role is not a valid enum value', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ tenantId: 1, role: 'superadmin' })
        .expect(400);
    });

    it('should return 400 when body is empty', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });

  // =========================================================================
  // PROPERTIES — unauthenticated requests
  // =========================================================================
  describe('/properties (unauthenticated)', () => {
    it('GET /properties without token should return 401', () => {
      return request(app.getHttpServer()).get('/properties').expect(401);
    });

    it('POST /properties without token should return 401', () => {
      return request(app.getHttpServer()).post('/properties').expect(401);
    });

    it('DELETE /properties/1 without token should return 401', () => {
      return request(app.getHttpServer()).delete('/properties/1').expect(401);
    });
  });

  // =========================================================================
  // PROPERTIES — authenticated requests (admin token)
  // =========================================================================
  describe('/properties (authenticated as admin)', () => {
    it('GET /properties should return 200 with data and meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // The response should have the pagination shape we built in Phase 4
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /properties should create a property and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Property',
          address: '123 Test St',
          city: 'Austin',
          state: 'TX',
        })
        .expect(201);

      expect(res.body.name).toBe('E2E Test Property');
      expect(res.body.tenantId).toBe(tenantId);

      // Store the id so later tests can use it for GET/:id, PATCH, DELETE
      createdPropertyId = res.body.id;
    });

    it('POST /properties should return 400 when body is empty', () => {
      // Sending no fields — ALL required DTO fields are missing.
      // This guarantees a 400 regardless of which specific validators are set.
      return request(app.getHttpServer())
        .post('/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('GET /properties should return the created property', async () => {
      const res = await request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('GET /properties/:id should return the property', async () => {
      const res = await request(app.getHttpServer())
        .get(`/properties/${createdPropertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdPropertyId);
      expect(res.body.name).toBe('E2E Test Property');
    });

    it('GET /properties/:id should return 404 for non-existent id', () => {
      return request(app.getHttpServer())
        .get('/properties/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('PATCH /properties/:id should update the property', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/properties/${createdPropertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated E2E Property' })
        .expect(200);

      expect(res.body.name).toBe('Updated E2E Property');
    });

    it('PATCH /properties/:id should return 404 for non-existent id', () => {
      return request(app.getHttpServer())
        .patch('/properties/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Wont Work' })
        .expect(404);
    });

    it('GET /properties should filter by city', async () => {
      const res = await request(app.getHttpServer())
        .get('/properties?city=Austin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Every returned property should be in Austin
      res.body.data.forEach((p: any) => {
        expect(p.city).toBe('Austin');
      });
    });

    it('GET /properties should return empty when city filter has no matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/properties?city=NonExistentCity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('DELETE /properties/:id should delete the property and return 200', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/properties/${createdPropertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdPropertyId);
    });

    it('GET /properties/:id should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/properties/${createdPropertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // PROPERTIES — role enforcement (viewer token)
  // =========================================================================
  describe('/properties (authenticated as viewer)', () => {
    it('GET /properties should return 200 — open to all authenticated users', () => {
      return request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('DELETE /properties/:id should return 403 — admin only', async () => {
      // Create a property to attempt deletion on
      const createRes = await request(app.getHttpServer())
        .post('/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Role Test Property',
          address: '456 Role St',
          city: 'Dallas',
          state: 'TX',
        });

      const id = createRes.body.id;

      // Viewer tries to delete — RolesGuard should block with 403
      await request(app.getHttpServer())
        .delete(`/properties/${id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      // Clean up — admin deletes it
      await request(app.getHttpServer())
        .delete(`/properties/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });
  });
});

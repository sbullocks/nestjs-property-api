# Advanced Build Checklist — Full PropertyCo-Style Model

8 models, real authentication, multi-level relation filtering. Build in stages — each stage
adds models that depend on the previous stage's models existing first (FK constraints).

Reference `data-model.md` for the full ERD. Reference `my-notes.md` for the *why* behind every
pattern you already know — most of this is the same patterns applied to more models.

---

## Stage 1 — Real Auth Foundation (Company + User)

This replaces the v1 shortcut (login with just tenantId+role, no real credentials) with actual
authentication.

- [ ] `mkdir app-v2` → `cd app-v2` → `nest new .`
- [ ] Set up Prisma — same as v1 (`prisma-client-js` generator, `DATABASE_URL`)
- [ ] Define `Company` model — `id, name, plan, createdAt`
- [ ] Define `User` model — `id, email (unique), passwordHash, role, companyId FK, createdAt`
- [ ] `npx prisma migrate dev --name init`
- [ ] `npm install bcrypt` + `npm install --save-dev @types/bcrypt`
- [ ] Build `AuthModule` — but this time with a real `register` endpoint:
  - `register(email, password, companyId)` → `bcrypt.hash(password, 10)` → create User
  - `login(email, password)` → find User by email → `bcrypt.compare(password, user.passwordHash)` → throw `UnauthorizedException` if false → sign JWT
- [ ] JWT payload is now `{ sub: user.id, companyId: user.companyId, role: user.role }` — `sub` is the REAL user id this time, not a shortcut
- [ ] Same `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` pattern as v1 — no changes needed there
- [ ] Test: register a user → login → decode the JWT at jwt.io → confirm `sub` is the user's actual id

---

## Stage 2 — Property + Unit

Same single-level FK pattern as v1's Property, plus one new level (Unit).

- [ ] Define `Property` model — `companyId FK` (same as v1's `tenantId` pattern, just renamed)
- [ ] Define `Unit` model — `propertyId FK`, `unitNumber, bedrooms, bathrooms, squareFeet, rentAmount, status`
- [ ] `npx prisma migrate dev --name add-property-unit`
- [ ] `nest generate resource properties` → wire up exactly like v1 (filter by `companyId` from JWT)
- [ ] `nest generate resource units`
- [ ] **New pattern:** Unit has no direct `companyId` — filter through the relation:
  ```ts
  findAll(companyId: number) {
    return prisma.unit.findMany({
      where: { property: { companyId } }
    });
  }
  ```
- [ ] Test multi-tenancy again: 2 companies, confirm Company A can't see Company B's units

---

## Stage 3 — Resident + Lease

Lease is the hub — it connects Unit and Resident. This is the first model with two FKs to two
different unrelated tables.

- [ ] Define `Resident` model — standalone, no FK (`firstName, lastName, email, phone`)
- [ ] Define `Lease` model — `unitId FK`, `residentId FK`, `monthlyRent, startDate, endDate, status`
- [ ] `npx prisma migrate dev --name add-resident-lease`
- [ ] `nest generate resource residents` — no tenant scoping needed at this level (Resident isn't owned by a company directly)
- [ ] `nest generate resource leases`
- [ ] **New pattern — 3 levels deep:**
  ```ts
  findAll(companyId: number) {
    return prisma.lease.findMany({
      where: { unit: { property: { companyId } } },
      include: { unit: true, resident: true },
    });
  }
  ```
- [ ] Test: create a lease linking a unit + resident, confirm `include` returns both nested

---

## Stage 4 — Payment + MaintenanceRequest

The leaf nodes. Payment is 4 levels deep — the deepest filter chain in this model.

- [ ] Define `Payment` model — `leaseId FK`, `amount, paidAt, status, stripePaymentId`
- [ ] Define `MaintenanceRequest` model — `unitId FK`, `residentId FK`, `title, description, priority, status, resolvedAt`
- [ ] `npx prisma migrate dev --name add-payment-maintenance`
- [ ] `nest generate resource payments`
- [ ] `nest generate resource maintenance-requests`
- [ ] **4-level filter for Payment:**
  ```ts
  findAll(companyId: number) {
    return prisma.payment.findMany({
      where: { lease: { unit: { property: { companyId } } } },
    });
  }
  ```
- [ ] **MaintenanceRequest filter (3 levels, same shape as Lease):**
  ```ts
  where: { unit: { property: { companyId } } }
  ```
- [ ] Test: create a payment against a lease, confirm it only shows up for the right company

---

## Stage 5 — Granular RBAC

Replace the 3-role enum from v1 with role-appropriate permissions for a real org.

- [ ] Expand `Role` enum — `PropertyManager`, `LeasingAgent`, `MaintenanceStaff`, `ResidentPortal`
- [ ] Decide per-route who can do what — example:
  - `PropertyManager` — full access to everything in their company
  - `LeasingAgent` — create/read Leases and Residents, can't delete Properties
  - `MaintenanceStaff` — read/update MaintenanceRequests only, can't see Leases or Payments
  - `ResidentPortal` — read their own Lease + submit MaintenanceRequests only
- [ ] Apply `@Roles(...)` per route based on the above
- [ ] Test each role against a route it should be blocked from — expect 403

---

## Stage 6 — Validation + Pagination (Apply to All New Resources)

Same exact patterns as v1's Phase 3 + Phase 4, just repeated across every new model.

- [ ] `CreateDto` for each model with `@ApiProperty` + appropriate validators
- [ ] `QueryDto` for each list endpoint — pagination + relevant filters (e.g. Lease by `status`, Payment by `status`)
- [ ] `findFirst` + `NotFoundException` pattern on every `findOne`/`update`/`remove`
- [ ] Tenant isolation check on every write — verify the FK chain resolves to the caller's `companyId` before allowing the mutation (critical: a LeasingAgent shouldn't be able to create a Lease for a Unit belonging to another company)

---

## Stage 7 — Testing

Same patterns as v1's Phase 5, scaled to 8 models. This stage will produce the most files.

- [ ] `.service.spec.ts` for every service — mock Prisma, test CRUD + NotFoundException cases
- [ ] `.controller.spec.ts` for every controller — test delegation
- [ ] `roles.guard.spec.ts` — test all 4 new roles against various route requirements
- [ ] `auth.service.spec.ts` — test bcrypt hashing/comparison logic (mock bcrypt itself, don't hash for real in tests)
- [ ] `test/app.e2e-spec.ts` — full flow: register → login → create Property → Unit → Resident → Lease → Payment, confirm full chain works end to end with a real (test) database

---

## Stage 8 — Config, Rate Limiting, Caching

Same as v1's Phase 6 — but apply the lesson learned the hard way last time.

- [ ] ConfigModule + Joi validation
- [ ] ConfigService replacing process.env, JwtModule.registerAsync
- [ ] ThrottlerModule globally + stricter limit on login
- [ ] CacheModule — **do NOT add `@UseInterceptors(CacheInterceptor)` to any company-scoped list route.** You already found this bug once in v1 (tenant 2 saw tenant 1's cached data). If you want caching here, the cache key must include `companyId`, which requires a custom interceptor — out of scope unless you want an extra challenge.
- [ ] `GET /health` with `@SkipThrottle()`

---

## What's Genuinely New Here vs v1

| Pattern | v1 | This build |
|---|---|---|
| Auth | Fake login (tenantId+role only) | Real bcrypt password hashing |
| FK depth | 1 level (`tenantId`) | Up to 4 levels (`Payment → Lease → Unit → Property → Company`) |
| Roles | 3 generic roles | 4 roles mapped to real job functions |
| Models | 2 | 8 |
| Relation filtering | `where: { tenantId }` | `where: { lease: { unit: { property: { companyId } } } }` |

Everything else — guards, pipes, validation, DTOs, pagination, testing structure, config, rate
limiting — is identical to what you already know. This is the same skillset, deliberately
stretched across a harder schema.

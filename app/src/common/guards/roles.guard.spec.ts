import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

// ---------------------------------------------------------------------------
// HELPER — createMockContext
// The guard needs an ExecutionContext to read metadata and the request.
// We can't use a real HTTP context in a unit test, so we build a fake one.
//
// getHandler() and getClass() are what Reflector uses to read @Roles() metadata.
// switchToHttp().getRequest() is how the guard reads request.user.
//
// requiredRoles is what @Roles() would have attached as metadata.
// userRole is what's sitting on request.user.role from the JWT.
// ---------------------------------------------------------------------------
const createMockContext = (
  userRole: string,
  requiredRoles?: Role[],
): ExecutionContext => {
  // Create a fake handler function. If requiredRoles are provided, we attach
  // the metadata to it so Reflector can read it — simulating @Roles() on a route.
  const handler = jest.fn();
  if (requiredRoles) {
    Reflect.defineMetadata(ROLES_KEY, requiredRoles, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => ({}),   // class-level metadata — empty for these tests
    switchToHttp: () => ({
      getRequest: () => ({
        user: { sub: 1, tenantId: 1, role: userRole },
      }),
    }),
  } as unknown as ExecutionContext;
};

// ---------------------------------------------------------------------------
// TEST SUITE
// RolesGuard has no async dependencies — no NestJS module setup needed.
// We instantiate it directly with a real Reflector.
// ---------------------------------------------------------------------------
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  // =========================================================================
  // No @Roles() on the route — open to all authenticated users
  // =========================================================================
  describe('when no roles are required', () => {
    it('should return true (open to any authenticated user)', () => {
      // No requiredRoles passed → handler has no metadata → Reflector returns undefined
      // Guard hits: if (!requiredRoles) return true
      const context = createMockContext('viewer');

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  // =========================================================================
  // @Roles(Role.Admin) — only admins allowed
  // =========================================================================
  describe('when Admin role is required', () => {
    it('should return true when user has Admin role', () => {
      const context = createMockContext('admin', [Role.Admin]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return false when user has TenantUser role', () => {
      const context = createMockContext('tenant_user', [Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should return false when user has Viewer role', () => {
      const context = createMockContext('viewer', [Role.Admin]);

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  // =========================================================================
  // @Roles(Role.Admin, Role.TenantUser) — multiple roles allowed
  // =========================================================================
  describe('when multiple roles are required', () => {
    it('should return true when user has Admin role', () => {
      const context = createMockContext('admin', [Role.Admin, Role.TenantUser]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return true when user has TenantUser role', () => {
      const context = createMockContext('tenant_user', [Role.Admin, Role.TenantUser]);

      // requiredRoles.some() — user only needs ONE of the required roles
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return false when user has Viewer role (not in the allowed list)', () => {
      const context = createMockContext('viewer', [Role.Admin, Role.TenantUser]);

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  // =========================================================================
  // @Roles(Role.Viewer) — viewer-only route
  // =========================================================================
  describe('when Viewer role is required', () => {
    it('should return true when user has Viewer role', () => {
      const context = createMockContext('viewer', [Role.Viewer]);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should return false when user has Admin role', () => {
      // Admin is NOT automatically a superset of all roles in this guard.
      // If a route only allows viewers, an admin is rejected.
      // Role-based access is explicit — not hierarchical.
      const context = createMockContext('admin', [Role.Viewer]);

      expect(guard.canActivate(context)).toBe(false);
    });
  });
});

export interface JwtPayload {
  sub: number; // subject — the user/tenant id (who the token is about)
  tenantId: number; // for multi-tenant scoping
  role: string; // for RBAC
}

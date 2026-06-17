// — `{ sub, tenantId, role }`
// The payload is what gets packed into the token.

export interface JwtPayload {
  sub: number;          // subject - stardard JWT claim, conventionally the users ID
  tenantId: number;     // for multi-tenant query scoping
  role: string;         // for RBAC -role based access control
}
// — export `ROLES_KEY = 'roles'`, `@Roles()` uses `SetMetadata(ROLES_KEY, roles)` — **NOT the string `'ROLES_KEY'`**

// @setMetadata('roles', ['admin']) attaches invisible metadata to the route handler (like putting a sticky note on a function). Just stores data.
// RolesGuard is what reads it and enforces it.


// import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';


export const ROLES_KEY = 'roles';
// export const Roles = Reflector.createDecorator<string[]>();
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

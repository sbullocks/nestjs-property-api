// Instead of @Req() req and req.user everywhere, create a clean decorator:

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage is clean now:
// @Get()
// findAll(@CurrentUser() user: JwtPayload) {
//   return this.propertiesService.findAll(user.tenantId);
// }

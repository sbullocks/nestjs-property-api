import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    // console.log(apiKey);
    if (apiKey === process.env.API_KEY) return true;
    throw new UnauthorizedException();
  }
}

// Create src/common/guards/api-key.guard.ts. Implement CanActivate. Read x-api-key from request headers. Return true if it matches. Throw UnauthorizedException if not.
// Apply @UseGuards(ApiKeyGuard) above the @Controller decorator in properties.controller.ts. Pass the class — not new ApiKeyGuard().

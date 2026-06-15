import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

//  Why is it this short? AuthGuard('jwt') is a factory from @nestjs/passport. When you pass 'jwt', it returns a fully built guard class that already knows how to:
//   1. Extract the Bearer token from the Authorization header
//   2. Hand it to your JwtStrategy (which you wired up in Step 5)
//   3. Attach the validated payload to request.user
//   4. Throw a 401 if the token is missing, expired, or tampered

// You're not reimplementing that logic — you're extending the pre-built guard. This follows the same extends PassportStrategy(Strategy) pattern you used for JwtStrategy.

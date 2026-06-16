import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // jwtFromRequest tells passport where to look for the token. fromAuthHeaderAsBearerToken reads Authorization: Bearer <token>.
      ignoreExpiration: false,
      // secretOrKey: process.env.JWT_SECRET!, // in Phase 6, instead of using process.env.JWT_SECRET directly, need to inject ConfigService.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // validate() runs after the signature is verified. Whatever you return here gets attached to request.user. In this case, the full payload, so request.user.tenantId is available everywhere.
    return payload; // attached to request.user
  }
}

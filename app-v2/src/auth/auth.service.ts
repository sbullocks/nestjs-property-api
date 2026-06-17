import { Injectable } from '@nestjs/common';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';

// Write `AuthService.login()` — signs JWT with `{ sub: tenantId, tenantId, role }`
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(tenantId: number, role: string): Promise<{ access_token: string }> {
    const payload: JwtPayload = { sub: tenantId, tenantId, role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}



import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(
    tenantId: number,
    role: string,
  ): Promise<{ access_token: string }> {
    const payload: JwtPayload = { sub: tenantId, tenantId, role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

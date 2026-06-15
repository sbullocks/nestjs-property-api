import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { tenantId: number; role: string }) {
    return this.authService.login(body.tenantId, body.role);
  }
}

// create a POST /auth/login route that calls the service and returns the token.

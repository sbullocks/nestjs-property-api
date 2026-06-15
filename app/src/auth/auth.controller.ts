import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  @ApiResponse({ status: 201, description: 'Returns access_token' })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.tenantId, body.role);
  }
}

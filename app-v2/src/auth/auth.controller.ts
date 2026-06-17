import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Throttle } from '@nestjs/throttler';



@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  @ApiResponse({ status: 201, description: 'Returns access_token' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.tenantId, body.role)
  }
}



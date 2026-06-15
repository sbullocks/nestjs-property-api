import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// MOCK JWT SERVICE
// The real JwtService talks to @nestjs/jwt internals and needs a secret key.
// We replace it with a mock that returns a predictable token string.
// mockReturnValue (not mockResolvedValue) because jwtService.sign() is
// synchronous — it returns a value directly, not a promise.
// ---------------------------------------------------------------------------
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset mock call history before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // login()
  // =========================================================================
  describe('login', () => {
    it('should return an object with access_token', async () => {
      const result = await service.login(1, 'admin');

      // The response shape must include access_token
      expect(result).toHaveProperty('access_token');
    });

    it('should return the token produced by jwtService.sign', async () => {
      const result = await service.login(1, 'admin');

      // The token value should be whatever jwtService.sign returned.
      // Our mock returns 'mock.jwt.token' — so that's what we assert.
      expect(result.access_token).toBe('mock.jwt.token');
    });

    it('should call jwtService.sign with the correct payload', async () => {
      await service.login(1, 'admin');

      // toHaveBeenCalledWith verifies the exact arguments passed to the mock.
      // This is the most important test — it confirms the payload structure
      // that gets signed into the JWT is correct.
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,       // sub = tenantId in our demo (simplified)
        tenantId: 1,
        role: 'admin',
      });
    });

    it('should call jwtService.sign exactly once per login call', async () => {
      await service.login(1, 'admin');

      // Confirms sign is called once — not zero times (bug) or twice (also a bug)
      expect(mockJwtService.sign).toHaveBeenCalledTimes(1);
    });

    it('should correctly pass different tenantId and role values', async () => {
      await service.login(42, 'viewer');

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 42,
        tenantId: 42,
        role: 'viewer',
      });
    });
  });
});

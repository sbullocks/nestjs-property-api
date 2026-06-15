import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Controller unit tests verify that the controller correctly delegates to the
// service with the right arguments. The service is mocked — we already tested
// its logic in auth.service.spec.ts.
// ---------------------------------------------------------------------------

const mockAuthService = {
  login: jest.fn().mockResolvedValue({ access_token: 'mock.jwt.token' }),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login with tenantId and role from the body', async () => {
      await controller.login({ tenantId: 1, role: 'admin' } as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(1, 'admin');
    });

    it('should return the access_token from the service', async () => {
      const result = await controller.login({ tenantId: 1, role: 'admin' } as any);

      expect(result).toEqual({ access_token: 'mock.jwt.token' });
    });
  });
});

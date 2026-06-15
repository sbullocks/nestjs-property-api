import { Test } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

// ---------------------------------------------------------------------------
// Controller unit tests verify the controller correctly delegates to the
// service. Guards and pipes are NOT tested here — they're tested in their
// own spec files and in e2e tests. The service is mocked.
// ---------------------------------------------------------------------------

const mockProperty = {
  id: 1,
  name: 'Sunset Apartments',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  tenantId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPropertiesService = {
  findAll: jest.fn().mockResolvedValue({ data: [mockProperty], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } }),
  findOne: jest.fn().mockResolvedValue(mockProperty),
  create: jest.fn().mockResolvedValue(mockProperty),
  update: jest.fn().mockResolvedValue({ ...mockProperty, name: 'Updated' }),
  remove: jest.fn().mockResolvedValue(mockProperty),
};

// Mock JWT user — what @CurrentUser() would extract from the JWT
const mockUser = { sub: 1, tenantId: 1, role: 'admin' };

describe('PropertiesController', () => {
  let controller: PropertiesController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        { provide: PropertiesService, useValue: mockPropertiesService },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with tenantId from JWT and query params', async () => {
      const query = { page: 1, limit: 10 };
      await controller.findAll(mockUser, query as any);

      expect(mockPropertiesService.findAll).toHaveBeenCalledWith(1, query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with numeric id and tenantId from JWT', async () => {
      await controller.findOne('1', mockUser);

      // +id converts the string '1' to the number 1
      expect(mockPropertiesService.findOne).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('create', () => {
    it('should call service.create with DTO and tenantId from JWT', async () => {
      const dto = { name: 'Test', address: '123 St', city: 'Austin', state: 'TX' };
      await controller.create(mockUser, dto as any);

      // tenantId comes from the JWT (mockUser.tenantId), not the DTO
      expect(mockPropertiesService.create).toHaveBeenCalledWith(dto, 1);
    });
  });

  describe('update', () => {
    it('should call service.update with id, DTO, and tenantId from JWT', async () => {
      const dto = { name: 'Updated Name' };
      await controller.update('1', mockUser, dto as any);

      expect(mockPropertiesService.update).toHaveBeenCalledWith(1, dto, 1);
    });
  });

  describe('remove', () => {
    it('should call service.remove with numeric id and tenantId from JWT', async () => {
      await controller.remove('1', mockUser);

      expect(mockPropertiesService.remove).toHaveBeenCalledWith(1, 1);
    });
  });
});

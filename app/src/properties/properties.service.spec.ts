import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// MOCK DATA
// A fake property object that represents what Prisma would return from the DB.
// Used across multiple tests so we define it once here.
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

// ---------------------------------------------------------------------------
// MOCK PRISMA SERVICE
// Replaces the real PrismaService so no database connection is needed.
// jest.fn() creates a fake function — we control what it returns in each test.
// ---------------------------------------------------------------------------
const mockPrismaService = {
  property: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// TEST SUITE
// describe() groups all tests for PropertiesService together.
// ---------------------------------------------------------------------------
describe('PropertiesService', () => {
  let service: PropertiesService;

  // -------------------------------------------------------------------------
  // SETUP — runs before EACH individual test
  // Creates a fresh NestJS test module every time so tests don't share state.
  // The mock replaces PrismaService in the DI container.
  // -------------------------------------------------------------------------
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);

    // Clear all mock call history before each test so one test's calls
    // don't bleed into the next test's assertions.
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // SANITY CHECK — confirms the service was created successfully by DI
  // -------------------------------------------------------------------------
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // findAll()
  // =========================================================================
  describe('findAll', () => {
    it('should return data and meta when properties exist', async () => {
      // Tell the mock what to return when findMany and count are called.
      // mockResolvedValue = the async function will resolve with this value.
      mockPrismaService.property.findMany.mockResolvedValue([mockProperty]);
      mockPrismaService.property.count.mockResolvedValue(1);

      const result = await service.findAll(1, {});

      // The response shape should have data (the array) and meta (pagination info)
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Sunset Apartments');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return empty data and total 0 when no properties match', async () => {
      mockPrismaService.property.findMany.mockResolvedValue([]);
      mockPrismaService.property.count.mockResolvedValue(0);

      const result = await service.findAll(1, {});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should calculate correct pagination offsets', async () => {
      mockPrismaService.property.findMany.mockResolvedValue([mockProperty]);
      mockPrismaService.property.count.mockResolvedValue(25);

      // Page 3 with limit 5 → skip 10 records, take 5
      await service.findAll(1, { page: 3, limit: 5 });

      // Verify findMany was called with the correct skip and take values.
      // toHaveBeenCalledWith checks what arguments the mock received.
      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should filter by city when provided', async () => {
      mockPrismaService.property.findMany.mockResolvedValue([mockProperty]);
      mockPrismaService.property.count.mockResolvedValue(1);

      await service.findAll(1, { city: 'Austin' });

      // The where clause passed to findMany should include the city filter
      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ city: 'Austin' }),
        }),
      );
    });

    it('should apply case-insensitive search on name when search provided', async () => {
      mockPrismaService.property.findMany.mockResolvedValue([mockProperty]);
      mockPrismaService.property.count.mockResolvedValue(1);

      await service.findAll(1, { search: 'sunset' });

      expect(mockPrismaService.property.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'sunset', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  // =========================================================================
  // findOne()
  // =========================================================================
  describe('findOne', () => {
    it('should return the property when found', async () => {
      // findFirst returns the property — both id and tenantId matched
      mockPrismaService.property.findFirst.mockResolvedValue(mockProperty);

      const result = await service.findOne(1, 1);

      expect(result).toEqual(mockProperty);
    });

    it('should throw NotFoundException when property does not exist', async () => {
      // findFirst returns null — no record matched id AND tenantId
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      // rejects.toThrow verifies the promise rejects with the expected error class.
      // This tests that our "if (!property) throw new NotFoundException()" line works.
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when property belongs to different tenant', async () => {
      // Same situation from the DB perspective — findFirst returns null
      // because tenantId didn't match, even if id did.
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      await expect(service.findOne(1, 2)).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================
  describe('create', () => {
    it('should create a property with the correct data', async () => {
      mockPrismaService.property.create.mockResolvedValue(mockProperty);

      const dto = {
        name: 'Sunset Apartments',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
      };

      const result = await service.create(dto, 1);

      expect(result).toEqual(mockProperty);

      // Verify the tenantId from the JWT was included in the data,
      // not something from the DTO. This is the security check.
      expect(mockPrismaService.property.create).toHaveBeenCalledWith({
        data: { ...dto, tenantId: 1 },
      });
    });
  });

  // =========================================================================
  // update()
  // =========================================================================
  describe('update', () => {
    it('should update and return the property when found', async () => {
      // findFirst finds the existing property (ownership verified)
      mockPrismaService.property.findFirst.mockResolvedValue(mockProperty);
      // update returns the modified property
      mockPrismaService.property.update.mockResolvedValue({
        ...mockProperty,
        name: 'Updated Name',
      });

      const result = await service.update(1, { name: 'Updated Name' }, 1);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when property not found before updating', async () => {
      // findFirst returns null → service throws before update is ever called
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'Updated Name' }, 1),
      ).rejects.toThrow(NotFoundException);

      // Confirm update was never called — we threw before reaching it
      expect(mockPrismaService.property.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================
  describe('remove', () => {
    it('should delete and return the property when found', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(mockProperty);
      mockPrismaService.property.delete.mockResolvedValue(mockProperty);

      const result = await service.remove(1, 1);

      expect(result).toEqual(mockProperty);
      expect(mockPrismaService.property.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when property not found before deleting', async () => {
      mockPrismaService.property.findFirst.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);

      // Confirm delete was never called — we threw before reaching it
      expect(mockPrismaService.property.delete).not.toHaveBeenCalled();
    });
  });
});

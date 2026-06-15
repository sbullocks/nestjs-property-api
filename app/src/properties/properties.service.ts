import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from '../prisma/prisma.service'; // brings in the service so you can inject it
import { Property } from '@prisma/client'; // brings in the generated type so TypeScript knows what findMany() returns
import { Prisma } from '@prisma/client';
import { QueryPropertyDto } from './dto/query-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {} // inject it so this.prisma is available
  // create(createPropertyDto: CreatePropertyDto) {
  //   return 'This action adds a new property';
  // } // in Phase 3, replacing the create() stub with real prisma insert.

  // REQUIRED: MAKE SURE THAT THE tenantId COMES FROM THE JWT, NOT THE DTO.
  async create(dto: CreatePropertyDto, tenantId: number): Promise<Property> {
    return this.prisma.property.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  // findAll() {
  //   return `This action returns all properties`;
  // }

  // returns all properties from all tenants! THIS IS NOT RLS!
  // async findAll(): Promise<Property[]> {
  //   return this.prisma.property.findMany(); // using this.prisma since its now available
  // }

  // async findAll(tenantId: number): Promise<Property[]> {
  //   return this.prisma.property.findMany({
  //     where: { tenantId },
  //   });
  // }

  async findAll(tenantId: number, query: QueryPropertyDto) {
    const where: Prisma.PropertyWhereInput = { tenantId };
    if (query.city) where.city = query.city;
    if (query.state) where.state = query.state;
    if (query.search)
      where.name = { contains: query.search, mode: 'insensitive' };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({ where, skip, take: limit }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // findOne(id: number) {
  //   return `This action returns a #${id} property`;
  // } // in Phase 3, replacing with the findFirst method (not findUnique bc filtering by both id and tenantId)

  async findOne(id: number, tenantId: number): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId },
    });

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`);
    }

    return property;
  }

  // update(id: number, updatePropertyDto: UpdatePropertyDto) {
  //   return `This action updates a #${id} property`;
  // } // in Phase 3, updating this to use the tenantId from user and not the DTO. REQUIRED.

  async update(
    id: number,
    dto: UpdatePropertyDto,
    tenantId: number,
  ): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId },
    });

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`);
    }

    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  // remove(id: number) {
  //   return `This action removes a #${id} property`;
  // } // in Phase 3 updating to use the JWT user.id and not the DTO info. REQUIRED

  async remove(id: number, tenantId: number): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId },
    });

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`);
    }

    return this.prisma.property.delete({ where: { id } });
  }
}

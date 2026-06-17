import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Property } from 'generated/prisma';

@Injectable()
export class PropertiesService {
  constructor(
  private readonly prisma: PrismaService,
) {}
  create(createPropertyDto: CreatePropertyDto, tenantId: number) {
    return 'This action adds a new property';
  }

  // findAll() {
  //   return `This action returns all properties`;
  // }


  // async findAll(tenantId: number): Promise<Property[]> {
  //   return this.prisma.property.findMany({
  //     where: {tenantId: 1}
  //   })
  // } // as of Phase 2 insturction of `Update all service methods to accept tenantId parameter — replace hardcoded value`.. meaning replace the where: {tenantId: 1} < hardcoded with the actual tenantId.. where: {tenantId: tenantId}

  async findAll(tenantId: number): Promise<Property[]> {
    return this.prisma.property.findMany({
      where: { tenantId },
    });
  }

  findOne(id: number, tenantId: number) {
    return `This action returns a #${id} property`;
  }

  update(id: number, updatePropertyDto: UpdatePropertyDto, tenantId: number) {
    return `This action updates a #${id} property`;
  }

  remove(id: number, tenantId: number) {
    return `This action removes a #${id} property`;
  }
}

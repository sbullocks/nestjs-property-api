import { Injectable, NotFoundException } from '@nestjs/common';
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
    // return 'This action adds a new property';
    return this.prisma.property.create({
      data: {
        ...createPropertyDto, // copies name, address, city, state from the DTO
        tenantId, // always from the JWT - not from the request body. (this get handled in the controller using the user.tenantId from the JwtPayload)
      },
    });
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
    // console.log('findAll tenantId', tenantId) // shows up in the watching terminal where app is running.
    return this.prisma.property.findMany({
      where: { tenantId },
    });
  }

  async findOne(id: number, tenantId: number): Promise<Property> {
    // return `This action returns a #${id} property`;
     const property = await this.prisma.property.findFirst({
      where: { id, tenantId}
    })

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`)
    }

    return property;
  }

  // update(id: number, updatePropertyDto: UpdatePropertyDto, tenantId: number) {
  //   return `This action updates a #${id} property`;
  // }

  async update(id: number, updatePropertyDto: UpdatePropertyDto, tenantId: number): Promise<Property> {
    const property = await this.prisma.property.findFirst({
      where: {id, tenantId}
    })

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`)
    }

    return this.prisma.property.update({
      where: { id },
      data: updatePropertyDto
    });
  }

  // remove(id: number, tenantId: number) {
  //   return `This action removes a #${id} property`;
  // }

   async remove(id: number, tenantId: number): Promise<Property> {
    // return `This action removes a #${id} property`;
    const property = await this.prisma.property.findFirst({
      where: { id, tenantId}
    })

    if (!property) {
      throw new NotFoundException(`Property ${id} not found`)
    }

    return this.prisma.property.delete({
      where: { id }
    })
  }
}

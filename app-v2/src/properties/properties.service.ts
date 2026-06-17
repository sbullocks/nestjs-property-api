import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Property, Prisma } from 'generated/prisma';
import { QueryPropertyDto } from './dto/query-property.dto';

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

  async findAll(tenantId: number, query: QueryPropertyDto) {
    // console.log('findAll tenantId', tenantId) // shows up in the watching terminal where app is running.

    // supporting filtering/pagination
    // can paginate by: page, limit (how to slice the results)
    // can filter by: city, state, search (which results to include)

    // this means in the declared params, need to include query: QueryPropertyDto object to read from query.

    // queries for filtering
      const where: Prisma.PropertyWhereInput = { tenantId }
      if (query.city) where.city = query.city;
      if (query.state) where.state = query.state;
      if (query.search) where.name = { contains: query.search, mode: 'insensitive'};

    // calculations for pagaination offsets
      const page = query.page ?? 1 // defaults to page 1 if not sent in the request
      const limit = query.limit ?? 10 // defaults to 10 results if not sent in the request
      const skip = (page - 1) * limit // page 1 > skip 0, page 2 > skip 10, page 3 > skip 20..
      // skip is how many records we are jumping over
      // take is how many to return

      // now run the data and count queries in paralle
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

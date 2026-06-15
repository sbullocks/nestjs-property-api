import { Injectable } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PrismaService } from '../prisma/prisma.service'; // brings in the service so you can inject it
import { Property } from '@prisma/client'; // brings in the generated type so TypeScript knows what findMany() returns

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {} // inject it so this.prisma is available
  create(createPropertyDto: CreatePropertyDto) {
    return 'This action adds a new property';
  }

  // findAll() {
  //   return `This action returns all properties`;
  // }
  async findAll(): Promise<Property[]> {
    return this.prisma.property.findMany(); // using this.prisma since its now available
  }

  findOne(id: number) {
    return `This action returns a #${id} property`;
  }

  update(id: number, updatePropertyDto: UpdatePropertyDto) {
    return `This action updates a #${id} property`;
  }

  remove(id: number) {
    return `This action removes a #${id} property`;
  }
}

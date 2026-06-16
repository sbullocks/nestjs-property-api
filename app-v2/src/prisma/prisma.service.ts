import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('The module has been initalized!');
    await this.$connect();
  }
  async onModuleDestroy() {
    console.log('The module has been disconnected! ')
    await this.$disconnect()
  }
}

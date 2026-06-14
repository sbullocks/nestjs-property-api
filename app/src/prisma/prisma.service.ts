import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// OnModuleInit & OnModuleDestroy - These are lifecycle hooks NestJS fires at specific moments. Your PrismaService needs a database connection — but you can't open a connection at class definition time, you need to wait until NestJS has finished wiring everything up.
// Without these hooks, you'd have to manage the connection yourself. With them, NestJS handles it at exactly the right moment.
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // OnModuleInit fires after all modules are loaded and providers are resolved — right before the app starts accepting traffic. That's when $connect() runs.
  async onModuleInit() {
    await this.$connect();
  }
  // OnModuleDestroy fires when the app is shutting down. That's when $disconnect() runs — closes the connection cleanly instead of just dropping it.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

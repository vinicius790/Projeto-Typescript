import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  prototype: any;
  async onModuleInit() {
    await this.$connect();
  }
    $connect() {
        throw new Error('Method not implemented.');
    }

  async onModuleDestroy() {
    await this.$disconnect();
  }
    $disconnect() {
        throw new Error('Method not implemented.');
    }
}

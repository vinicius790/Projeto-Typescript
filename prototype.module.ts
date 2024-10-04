import { Module } from '@nestjs/common';
import { PrototypeService } from './prototype.module';
import { PrototypeController } from './prototype.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [PrototypeService, PrismaService],
  controllers: [PrototypeController],
})
export class PrototypeModule {}
export { PrototypeService };

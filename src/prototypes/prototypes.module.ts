import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrototypesController } from './prototypes.controller';
import { PrototypesRepository } from './prototypes.repository';
import { PrototypesService } from './prototypes.service';

@Module({
  // `AuthModule` fornece o `JwtAuthGuard` usado nas rotas de escrita.
  imports: [PrismaModule, AuthModule],
  controllers: [PrototypesController],
  providers: [PrototypesService, PrototypesRepository],
  exports: [PrototypesService, PrototypesRepository],
})
export class PrototypesModule {}

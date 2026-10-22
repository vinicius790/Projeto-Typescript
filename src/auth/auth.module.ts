import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginRateLimiter } from './login-rate-limiter';

/** Exporta o guard e o serviço de que ele depende, para os outros módulos protegerem rotas. */
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, LoginRateLimiter],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}

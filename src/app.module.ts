import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { validateEnv } from './config/env.validation';
import { DesignPatternsModule } from './design-patterns/design-patterns.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrototypesModule } from './prototypes/prototypes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AuthModule,
    PrototypesModule,
    UsersModule,
    DesignPatternsModule,
    MetricsModule,
  ],
  providers: [
    {
      // Pipe global: rejeita campos desconhecidos e converte os tipos dos DTOs.
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}


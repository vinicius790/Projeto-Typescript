import { Module } from '@nestjs/common';
import { DesignPatternsController } from './design-patterns.controller';

@Module({
  controllers: [DesignPatternsController],
})
export class DesignPatternsModule {}

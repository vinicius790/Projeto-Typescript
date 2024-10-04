import { Module } from '@nestjs/common';
import { PrototypeModule } from './prototype/prototype.module';

@Module({
  imports: [PrototypeModule],
})
export class AppModule {}

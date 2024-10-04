import { Controller, Post, Body, Param } from '@nestjs/common';
import { PrototypeService } from './prototype.service';


@Controller('prototype')
export class PrototypeController {
  constructor(private readonly prototypeService: PrototypeService) { }

  @Post()
  async createPrototype(@Body() body: { primitive: number; component: Date; }) {
    return this.prototypeService.createPrototype(body);
  }

  @Post(':id/clone')
  async clonePrototype(@Param('id') id: string): Promise<Prototype> {
    return this.prototypeService.clonePrototype(Number(id));
  }
}

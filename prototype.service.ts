import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prototype, CircularReference } from '@prisma/client';

@Injectable()
export class PrototypeService {
  constructor(private prisma: PrismaService) {}

  async createPrototype(data: { primitive: number; component: Date }): Promise<Prototype> {
    return this.prisma.prototype.create({
      data,
    });
  }

  async clonePrototype(id: number): Promise<Prototype> {
    const prototype = await this.prisma.prototype.findUnique({
      where: { id },
      include: { circularReference: true },
    });

    if (!prototype) {
      throw new Error('Prototype not found');
    }

    const clone = await this.prisma.prototype.create({
      data: {
        primitive: prototype.primitive,
        component: prototype.component,
        circularReference: {
          create: {
            prototype: { connect: { id: prototype.id } },
          },
        },
      },
    });

    return clone;
  }
}

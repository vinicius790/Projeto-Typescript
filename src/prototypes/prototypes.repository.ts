import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrototypeFilterDto } from './dto/prototype-filter.dto';
import { PaginatedPrototypesEntity } from './entities/prototype.entity';
import { prototypeInclude, PrototypeRecord } from './prototype.model';

export interface IPrototypesRepository {
  findAll(filter: PrototypeFilterDto): Promise<PaginatedPrototypesEntity>;
  findById(id: number, tx?: Prisma.TransactionClient): Promise<PrototypeRecord | null>;
  create(data: Prisma.PrototypeCreateInput, tx?: Prisma.TransactionClient): Promise<PrototypeRecord>;
  update(
    id: number,
    expectedVersion: number,
    data: Prisma.PrototypeUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
  delete(id: number, tx?: Prisma.TransactionClient): Promise<void>;
  createRevision(
    prototype: PrototypeRecord,
    actorId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  findRevision(
    prototypeId: number,
    version: number,
    tx?: Prisma.TransactionClient,
  ): Promise<any | null>;
  listRevisions(prototypeId: number): Promise<any[]>;
}

@Injectable()
export class PrototypesRepository implements IPrototypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Constrói dinamicamente cláusulas Where e OrderBy a partir do DTO de filtro
   * e executa contagem e paginação em transação de leitura.
   */
  async findAll(filter: PrototypeFilterDto): Promise<PaginatedPrototypesEntity> {
    const {
      page = 1,
      limit = 10,
      name,
      minPrimitive,
      maxPrimitive,
      startDate,
      endDate,
      hasCircular,
      sortBy = 'id',
      sortOrder = 'asc',
    } = filter;

    const where: Prisma.PrototypeWhereInput = {};

    if (name) {
      where.name = { contains: name };
    }

    if (minPrimitive !== undefined || maxPrimitive !== undefined) {
      where.primitive = {
        gte: minPrimitive !== undefined ? minPrimitive : undefined,
        lte: maxPrimitive !== undefined ? maxPrimitive : undefined,
      };
    }

    if (startDate || endDate) {
      where.component = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      };
    }

    if (hasCircular !== undefined) {
      where.circularReference = hasCircular ? { isNot: null } : { is: null };
    }

    const orderBy: Prisma.PrototypeOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const hasFilters = Object.keys(where).length > 0;
    const client = this.prisma;
    const [data, total] = await client.$transaction([
      client.prototype.findMany({
        ...(hasFilters ? { where } : {}),
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: prototypeInclude,
      }),
      client.prototype.count(hasFilters ? { where } : undefined),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: number, tx?: Prisma.TransactionClient): Promise<PrototypeRecord | null> {
    const client = tx ?? this.prisma;
    return client.prototype.findUnique({
      where: { id },
      include: prototypeInclude,
    });
  }

  async create(
    data: Prisma.PrototypeCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrototypeRecord> {
    const client = tx ?? this.prisma;
    return client.prototype.create({
      data,
      include: prototypeInclude,
    });
  }

  async update(
    id: number,
    expectedVersion: number,
    data: Prisma.PrototypeUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.prototype.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    return result.count;
  }

  async delete(id: number, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.prototype.delete({ where: { id } });
  }

  async createRevision(
    prototype: PrototypeRecord,
    actorId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.prototypeRevision.create({
      data: {
        prototype: { connect: { id: prototype.id } },
        actor: { connect: { id: actorId } },
        version: prototype.version,
        name: prototype.name,
        primitive: prototype.primitive,
        component: prototype.component,
        circularReferenceLabel: prototype.circularReference?.label ?? null,
      },
    });
  }

  async findRevision(
    prototypeId: number,
    version: number,
    tx?: Prisma.TransactionClient,
  ): Promise<any | null> {
    const client = tx ?? this.prisma;
    return client.prototypeRevision.findUnique({
      where: { prototypeId_version: { prototypeId, version } },
    });
  }

  async listRevisions(prototypeId: number): Promise<any[]> {
    return this.prisma.prototypeRevision.findMany({
      where: { prototypeId },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        prototypeId: true,
        version: true,
        name: true,
        primitive: true,
        component: true,
        circularReferenceLabel: true,
        recordedAt: true,
      },
    });
  }
}

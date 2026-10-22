import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { domainEventBus } from '../design-patterns/observer/domain-event-bus';
import { PrismaService } from '../prisma/prisma.service';
import { ClonePrototypeDto } from './dto/clone-prototype.dto';
import { CreatePrototypeDto } from './dto/create-prototype.dto';
import { PrototypeFilterDto } from './dto/prototype-filter.dto';
import { VersionedUpdatePrototypeDto } from './dto/update-prototype.dto';
import { PaginatedPrototypesEntity, PrototypeTemplateEntity } from './entities/prototype.entity';
import { createTemplateRegistry } from './prototype-templates';
import { prototypeInclude, PrototypeModel, PrototypeRecord } from './prototype.model';
import { PrototypesRepository } from './prototypes.repository';

@Injectable()
export class PrototypesService {
  private readonly templates = createTemplateRegistry();
  private readonly repo: PrototypesRepository;

  constructor(
    private readonly prisma: PrismaService,
    repository?: PrototypesRepository,
  ) {
    this.repo = repository ?? new PrototypesRepository(prisma);
  }

  async create(dto: CreatePrototypeDto, actorId: number): Promise<PrototypeRecord> {
    const model = new PrototypeModel(
      dto.name,
      dto.primitive,
      new Date(dto.component),
      dto.circularReference?.label,
    );
    const created = await this.prisma.$transaction((tx) =>
      this.createWithRevision(tx, model.toCreateInput(), actorId),
    );
    domainEventBus.publishSync('prototype.created', {
      id: created.id,
      name: created.name,
      primitive: created.primitive,
      actorId,
    });
    return created;
  }

  async findAll(filter: PrototypeFilterDto = new PrototypeFilterDto()): Promise<PaginatedPrototypesEntity> {
    return this.repo.findAll(filter);
  }


  async findOne(id: number): Promise<PrototypeRecord> {
    const prototype = await this.prisma.prototype.findUnique({
      where: { id },
      include: prototypeInclude,
    });
    if (!prototype) {
      throw new NotFoundException(`Protótipo ${id} não encontrado.`);
    }
    return prototype;
  }

  /** List immutable snapshots in chronological order, without public actor IDs. */
  async listRevisions(id: number) {
    await this.findOne(id);
    return this.prisma.prototypeRevision.findMany({
      where: { prototypeId: id },
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

  /** Optimistic concurrency plus snapshot creation run in the same transaction. */
  async update(
    id: number,
    dto: VersionedUpdatePrototypeDto,
    actorId: number,
  ): Promise<PrototypeRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.prototype.findUnique({ where: { id }, include: prototypeInclude });
      if (!current) {
        throw new NotFoundException(`Protótipo ${id} não encontrado.`);
      }
      if (dto.expectedVersion !== undefined && dto.expectedVersion !== current.version) {
        throw new ConflictException(
          `Versão desatualizada. Atual: ${current.version}; enviada: ${dto.expectedVersion}.`,
        );
      }

      const { expectedVersion: _expectedVersion, circularReference, ...changes } = dto;
      if (Object.values(changes).every((value) => value === undefined) && !circularReference) {
        return current;
      }

      const result = await tx.prototype.updateMany({
        where: { id, version: current.version },
        data: {
          name: changes.name,
          primitive: changes.primitive,
          component: changes.component === undefined ? undefined : new Date(changes.component),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'O protótipo foi alterado por outra requisição; releia e tente novamente.',
        );
      }

      if (circularReference) {
        await tx.circularReference.upsert({
          where: { prototypeId: id },
          create: { prototypeId: id, label: circularReference.label },
          update: { label: circularReference.label },
        });
      }

      const updated = await tx.prototype.findUnique({ where: { id }, include: prototypeInclude });
      if (!updated) {
        throw new NotFoundException(`Protótipo ${id} não encontrado.`);
      }
      await this.createRevision(tx, updated, actorId);
      domainEventBus.publishSync('prototype.updated', { id: updated.id, version: updated.version, actorId });
      return updated;
    });
  }

  /** Id inexistente gera o erro P2025 do Prisma, que o filtro global converte em 404. */
  async remove(id: number): Promise<void> {
    await this.prisma.prototype.delete({ where: { id } });
    domainEventBus.publishSync('prototype.deleted', { id });
  }

  /** Restoring appends a new version; it never overwrites earlier snapshots. */
  async restoreRevision(id: number, version: number, actorId: number): Promise<PrototypeRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.prototype.findUnique({ where: { id }, include: prototypeInclude });
      if (!current) {
        throw new NotFoundException(`Protótipo ${id} não encontrado.`);
      }
      const revision = await tx.prototypeRevision.findUnique({
        where: { prototypeId_version: { prototypeId: id, version } },
      });
      if (!revision) {
        throw new NotFoundException(`Versão ${version} do protótipo ${id} não encontrada.`);
      }

      const result = await tx.prototype.updateMany({
        where: { id, version: current.version },
        data: {
          name: revision.name,
          primitive: revision.primitive,
          component: revision.component,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'O protótipo foi alterado por outra requisição; releia e tente novamente.',
        );
      }

      if (revision.circularReferenceLabel === null) {
        await tx.circularReference.deleteMany({ where: { prototypeId: id } });
      } else {
        await tx.circularReference.upsert({
          where: { prototypeId: id },
          create: { prototypeId: id, label: revision.circularReferenceLabel },
          update: { label: revision.circularReferenceLabel },
        });
      }

      const restored = await tx.prototype.findUnique({ where: { id }, include: prototypeInclude });
      if (!restored) {
        throw new NotFoundException(`Protótipo ${id} não encontrado.`);
      }
      await this.createRevision(tx, restored, actorId);
      domainEventBus.publishSync('prototype.restored', { id: restored.id, version: restored.version, actorId });
      return restored;
    });
  }

  /**
   * Clona um registro usando o padrão Prototype: o registro vira um objeto de
   * domínio, `clone()` produz a cópia profunda e a cópia é gravada como um novo
   * registro, com o seu próprio componente circular.
   */
  async clone(id: number, dto: ClonePrototypeDto, actorId: number): Promise<PrototypeRecord> {
    const source = await this.findOne(id);
    const copy = PrototypeModel.fromRecord(source).clone();
    copy.name = dto.name ?? `${source.name} (cópia)`;

    const created = await this.prisma.$transaction((tx) =>
      this.createWithRevision(
        tx,
        { ...copy.toCreateInput(), clonedFrom: { connect: { id: source.id } } },
        actorId,
      ),
    );
    domainEventBus.publishSync('prototype.cloned', {
      sourceId: source.id,
      newId: created.id,
      name: created.name,
      actorId,
    });
    return created;
  }

  listTemplates(): PrototypeTemplateEntity[] {
    return this.templates.keys().map((key) => {
      const template = this.templates.create(key);
      return {
        key,
        name: template.name,
        primitive: template.primitive,
        component: template.component,
        circularReferenceLabel: template.circularReference?.label ?? null,
      };
    });
  }

  /** Cria um registro a partir de um modelo do catálogo (Prototype Registry). */
  createFromTemplate(
    key: string,
    dto: ClonePrototypeDto,
    actorId: number,
  ): Promise<PrototypeRecord> {
    if (!this.templates.has(key)) {
      throw new NotFoundException(`Modelo "${key}" não encontrado.`);
    }
    const model = this.templates.create(key);
    model.name = dto.name ?? model.name;
    return this.prisma.$transaction((tx) =>
      this.createWithRevision(tx, model.toCreateInput(), actorId),
    );
  }

  private async createWithRevision(
    tx: Prisma.TransactionClient,
    data: Prisma.PrototypeCreateInput,
    actorId: number,
  ): Promise<PrototypeRecord> {
    const created = await tx.prototype.create({ data, include: prototypeInclude });
    await this.createRevision(tx, created, actorId);
    return created;
  }

  private createRevision(tx: Prisma.TransactionClient, prototype: PrototypeRecord, actorId: number) {
    return tx.prototypeRevision.create({
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
}

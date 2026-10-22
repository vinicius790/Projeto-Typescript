import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Role } from '../auth/auth-user';
import { isRole } from '../auth/auth-user';
import { UserEntity } from '../auth/entities/auth.entity';
import { PaginationQueryDto } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedUsersEntity } from './entities/users.entity';

/** Só os campos públicos: o hash da senha nunca sai daqui. */
function toEntity(user: User): UserEntity {
  return {
    id: user.id,
    email: user.email,
    role: isRole(user.role) ? user.role : 'USER',
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page, limit }: PaginationQueryDto): Promise<PaginatedUsersEntity> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { id: 'asc' } }),
      this.prisma.user.count(),
    ]);
    return {
      data: users.map(toEntity),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Muda o papel de um usuário. Tirar o papel do ÚLTIMO ADMIN é recusado (409),
   * para o sistema nunca ficar sem administrador. Uma troca efetiva revoga todas
   * as sessões (tokens de renovação) do usuário.
   *
   * Tudo acontece numa transação que começa travando as linhas de todos os ADMIN
   * (um UPDATE que não muda nada, mas trava as linhas e conta quantas são). Assim,
   * dois ADMIN que tentam rebaixar um ao outro ao mesmo tempo são atendidos um
   * depois do outro, e o segundo já vê que só resta um ADMIN.
   */
  changeRole(id: number, role: Role): Promise<UserEntity> {
    return this.prisma.$transaction(async (tx) => {
      const admins = await tx.$executeRaw`UPDATE "User" SET "role" = "role" WHERE "role" = 'ADMIN'`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) {
        throw new NotFoundException(`Usuário ${id} não encontrado.`);
      }
      if (user.role === role) {
        return toEntity(user);
      }
      if (user.role === 'ADMIN' && admins <= 1) {
        throw new ConflictException('Não é possível remover o papel do último ADMIN.');
      }
      const updated = await tx.user.update({ where: { id }, data: { role } });
      // Encerra as sessões do usuário: para continuar, ele entra de novo e recebe
      // tokens com o papel novo. (Nas rotas com @Roles o guard já confere o banco.)
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return toEntity(updated);
    });
  }
}

import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, Role } from './auth-user';
import { isRole } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseEntity } from './entities/auth.entity';
import type { JwtClaims } from './jwt';
import { JwtError, signJwt, verifyJwt } from './jwt';
import { LoginRateLimiter, TooManyLoginAttemptsException } from './login-rate-limiter';
import { hashPassword, verifyPassword } from './password';

type TokenType = 'access' | 'refresh';

/** Código do Prisma para "violação de índice único". */
const UNIQUE_CONSTRAINT = 'P2002';

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  /**
   * Hash usado quando o e-mail do login não existe: a senha é conferida do
   * mesmo jeito, para o tempo de resposta não revelar quais e-mails têm conta.
   */
  private readonly dummyHash = hashPassword('');

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly loginLimiter: LoginRateLimiter,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
    this.accessTtl = config.getOrThrow<number>('JWT_ACCESS_TTL');
    this.refreshTtl = config.getOrThrow<number>('JWT_REFRESH_TTL');
  }

  /**
   * Cadastra um usuário e já devolve os tokens. O PRIMEIRO usuário do sistema
   * vira `ADMIN`; os seguintes são `USER`.
   */
  async register(dto: RegisterDto): Promise<AuthResponseEntity> {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('E-mail já cadastrado.');
    }
    const passwordHash = await hashPassword(dto.password);
    // Cadastro simultâneo do mesmo e-mail: o índice único gera P2002, que o
    // filtro global converte em 409.
    return this.respond(await this.createUser(email, passwordHash));
  }

  /**
   * Com o banco vazio, tenta gravar o usuário como o primeiro ADMIN. A garantia
   * vem do banco: `firstAdmin` é único, então, se dois cadastros simultâneos
   * virem o banco vazio, só um consegue gravar `firstAdmin = true`; o outro
   * recebe P2002 e é gravado como USER.
   */
  private async createUser(email: string, passwordHash: string): Promise<User> {
    if ((await this.prisma.user.count()) === 0) {
      try {
        return await this.prisma.user.create({
          data: { email, passwordHash, role: 'ADMIN', firstAdmin: true },
        });
      } catch (error) {
        const lostTheRace =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT;
        if (!lostTheRace) {
          throw error;
        }
        // Se o P2002 veio do e-mail repetido, a gravação abaixo falha de novo e vira 409.
      }
    }
    return this.prisma.user.create({ data: { email, passwordHash, role: 'USER' } });
  }

  /**
   * @param ip endereço de quem tenta entrar: junto com o e-mail, forma a chave
   * do limite de tentativas (429 com `Retry-After` quando estoura).
   */
  async login(dto: LoginDto, ip: string): Promise<AuthResponseEntity> {
    const email = dto.email.toLowerCase();
    const limitKey = `${ip}|${email}`;
    const retryAfter = await this.loginLimiter.consume(limitKey);
    if (retryAfter > 0) {
      throw new TooManyLoginAttemptsException(retryAfter);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) {
      // A mesma mensagem nos dois casos: não revela se o e-mail existe.
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    await this.loginLimiter.reset(limitKey);
    return this.respond(user);
  }

  /**
   * Troca um token de renovação válido por um novo par de tokens (rotação): o
   * token usado é revogado e o novo fica na mesma família. Reapresentar um token
   * já usado indica que ele vazou, então a família inteira é revogada.
   */
  async refresh(dto: RefreshTokenDto): Promise<AuthResponseEntity> {
    const { sub, jti } = this.verifyRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { id: jti } });
    if (!stored || stored.userId !== Number(sub)) {
      throw new UnauthorizedException('Token de renovação revogado.');
    }

    // Revoga só se ainda não estava revogado: de duas renovações simultâneas com
    // o mesmo token, só uma passa daqui.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(
        'Token de renovação já usado ou revogado; a sessão foi encerrada por segurança.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário do token não existe mais.');
    }
    return this.respond(user, stored.familyId);
  }

  /**
   * Encerra a sessão do token de renovação: ele e todos os tokens da mesma
   * família deixam de valer. Repetir o logout não tem efeito.
   */
  async logout(dto: RefreshTokenDto): Promise<void> {
    const { jti } = this.verifyRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { id: jti } });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  /**
   * Papel ATUAL do usuário, lido do banco (`null` se ele não existe mais). O guard
   * usa nas rotas com `@Roles`, para uma troca de papel valer na hora.
   */
  async currentRole(userId: number): Promise<Role | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      return null;
    }
    return isRole(user.role) ? user.role : 'USER';
  }

  /** Usado pelo guard: valida o token de acesso e devolve o usuário contido nele. */
  verifyAccessToken(token: string): AuthUser {
    const { sub, email, role } = this.verify(token, 'access');
    if (typeof email !== 'string' || !isRole(role)) {
      throw new UnauthorizedException('Token de acesso incompleto.');
    }
    return { id: Number(sub), email, role };
  }

  /** Valida o token de renovação e devolve o usuário (`sub`) e o id do token (`jti`). */
  private verifyRefreshToken(token: string): { sub: string; jti: string } {
    const { sub, jti } = this.verify(token, 'refresh');
    if (typeof jti !== 'string' || jti === '') {
      throw new UnauthorizedException('Token de renovação sem identificador.');
    }
    return { sub, jti };
  }

  /**
   * O campo `typ` separa os dois tipos de token: um token de renovação não
   * serve para acessar rotas, e um token de acesso não serve para renovar.
   */
  private verify(token: string, type: TokenType): JwtClaims & { sub: string } {
    let claims: JwtClaims;
    try {
      claims = verifyJwt(token, this.secret);
    } catch (error) {
      if (error instanceof JwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
    if (claims.typ !== type || typeof claims.sub !== 'string' || !/^\d+$/.test(claims.sub)) {
      throw new UnauthorizedException('Tipo de token incorreto para esta operação.');
    }
    return claims as JwtClaims & { sub: string };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Emite o par de tokens. O de renovação é gravado no banco (o `jti` é o id do
   * registro) para poder ser revogado; `familyId` liga os tokens de uma mesma
   * sessão, e um login novo começa uma família nova.
   */
  private async respond(user: User, familyId: string = randomUUID()): Promise<AuthResponseEntity> {
    const now = Date.now();
    const jti = randomUUID();
    // Faxina: os tokens vencidos do usuário não servem nem para detectar reuso.
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date(now) } },
    });
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        familyId,
        userId: user.id,
        expiresAt: new Date(now + this.refreshTtl * 1000),
      },
    });

    const sub = String(user.id);
    const role: Role = isRole(user.role) ? user.role : 'USER';
    return {
      tokenType: 'Bearer',
      accessToken: signJwt(
        { sub, email: user.email, role, typ: 'access' },
        this.secret,
        this.accessTtl,
        now,
      ),
      expiresIn: this.accessTtl,
      refreshToken: signJwt({ sub, typ: 'refresh', jti }, this.secret, this.refreshTtl, now),
      // Montado campo a campo: o hash da senha nunca sai na resposta.
      user: { id: user.id, email: user.email, role, createdAt: user.createdAt },
    };
  }
}

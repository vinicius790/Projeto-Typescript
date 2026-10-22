import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { LoginAttempt } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Tentativas de login permitidas por chave (IP + e-mail) dentro de uma janela. */
export const LOGIN_MAX_ATTEMPTS = 5;
/** Duração da janela, em milissegundos (15 minutos). */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** 429: a resposta leva o cabeçalho `Retry-After` com `retryAfterSeconds`. */
export class TooManyLoginAttemptsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `Muitas tentativas de login. Tente de novo em ${retryAfterSeconds} s.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Limite de tentativas de login por IP + e-mail, em janela fixa: até
 * `LOGIN_MAX_ATTEMPTS` tentativas a cada `LOGIN_WINDOW_MS`. A contagem fica na
 * tabela `LoginAttempt`, então vale para todas as instâncias da API que usam o
 * mesmo banco. A tentativa é contada ANTES de a senha ser conferida, e o
 * incremento é um único `upsert` (INSERT ... ON CONFLICT DO UPDATE), então
 * requisições simultâneas, em qualquer processo, também esbarram no limite. Um
 * login bem-sucedido apaga a contagem da chave.
 */
@Injectable()
export class LoginRateLimiter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra uma tentativa para a chave.
   *
   * @returns 0 se a tentativa pode seguir; senão, em quantos segundos a janela reabre.
   */
  async consume(key: string, now: number = Date.now()): Promise<number> {
    // Faxina: janelas vencidas (desta e de outras chaves) não contam mais.
    await this.prisma.loginAttempt.deleteMany({ where: { resetAt: { lte: new Date(now) } } });
    const { attempts, resetAt } = await this.increment(key, now);
    if (attempts <= LOGIN_MAX_ATTEMPTS) {
      return 0;
    }
    return Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
  }

  /** Esquece as tentativas da chave (depois de um login bem-sucedido). */
  async reset(key: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({ where: { key } });
  }

  private async increment(key: string, now: number, retry = true): Promise<LoginAttempt> {
    try {
      return await this.prisma.loginAttempt.upsert({
        where: { key },
        create: { key, attempts: 1, resetAt: new Date(now + LOGIN_WINDOW_MS) },
        update: { attempts: { increment: 1 } },
      });
    } catch (error) {
      // Dois processos criando a mesma chave ao mesmo tempo: o perdedor recebe
      // P2002 e tenta de novo, agora caindo no UPDATE.
      const raced = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (raced && retry) {
        return this.increment(key, now, false);
      }
      throw error;
    }
  }
}

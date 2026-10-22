// `enableImplicitConversion` lê os tipos emitidos pelos decorators.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Formato de `DATABASE_URL` aceito por cada banco suportado. */
const DATABASE_URL_PATTERNS = {
  sqlite: /^file:.+/,
  postgresql: /^postgres(ql)?:\/\/.+/,
} as const;

export type DatabaseProvider = keyof typeof DATABASE_URL_PATTERNS;

const DATABASE_URL_EXAMPLES: Record<DatabaseProvider, string> = {
  sqlite: 'file:./dev.db',
  postgresql: 'postgresql://usuario:senha@localhost:5432/banco',
};

const ONE_DAY = 86_400;

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** Banco em uso. Também escolhe o schema do Prisma (ver `prisma/prisma-cli.mjs`). */
  @IsIn(Object.keys(DATABASE_URL_PATTERNS), {
    message: 'DATABASE_PROVIDER deve ser "sqlite" ou "postgresql".',
  })
  DATABASE_PROVIDER: DatabaseProvider = 'sqlite';

  @IsString({ message: 'DATABASE_URL é obrigatória.' })
  @IsNotEmpty({ message: 'DATABASE_URL é obrigatória.' })
  DATABASE_URL!: string;

  /** Segredo da assinatura HMAC-SHA256 dos tokens. */
  @IsString({ message: 'JWT_SECRET é obrigatória.' })
  @MinLength(32, { message: 'JWT_SECRET deve ter pelo menos 32 caracteres.' })
  JWT_SECRET!: string;

  /** Validade do token de acesso, em segundos. */
  @IsInt()
  @Min(60)
  @Max(ONE_DAY)
  JWT_ACCESS_TTL: number = 900;

  /** Validade do token de renovação, em segundos. */
  @IsInt()
  @Min(60)
  @Max(90 * ONE_DAY)
  JWT_REFRESH_TTL: number = 7 * ONE_DAY;
}

/**
 * Valida as variáveis de ambiente na inicialização. Configuração errada derruba
 * a aplicação na partida, com mensagem clara, em vez de falhar na primeira
 * requisição.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const details = validateSync(validated).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
  // A URL tem de combinar com o banco escolhido (só confere se o banco é válido).
  const pattern = DATABASE_URL_PATTERNS[validated.DATABASE_PROVIDER] as RegExp | undefined;
  if (pattern && typeof validated.DATABASE_URL === 'string' && validated.DATABASE_URL !== '') {
    if (!pattern.test(validated.DATABASE_URL)) {
      const example = DATABASE_URL_EXAMPLES[validated.DATABASE_PROVIDER];
      details.push(
        `DATABASE_URL deve ser uma URL de ${validated.DATABASE_PROVIDER}, por exemplo "${example}".`,
      );
    }
  }
  if (details.length > 0) {
    throw new Error(`Variáveis de ambiente inválidas: ${details.join('; ')}`);
  }
  return validated;
}

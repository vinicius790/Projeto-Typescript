import type { Request } from 'express';

export const ROLES = ['USER', 'ADMIN'] as const;

/** Papel do usuário. No banco é um texto simples, para valer em SQLite e PostgreSQL. */
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

/** Usuário autenticado, como o guard o extrai do token de acesso. */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

/** Requisição depois de passar pelo `JwtAuthGuard`. */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

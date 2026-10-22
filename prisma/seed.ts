import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Gera hash scrypt compatível com o módulo de autenticação da aplicação (src/auth/password.ts).
 * Formato armazenado: scrypt$<sal em hex>$<chave em hex>
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`);
    });
  });
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 Iniciando Seeding Avançado do Banco de Dados');
  console.log('====================================================');

  const defaultPassword = 'Password123!';
  const hashedPassword = await hashPassword(defaultPassword);

  // --------------------------------------------------------------------------
  // 1. USUÁRIOS E PERFIS DE ACESSO (RBAC)
  // --------------------------------------------------------------------------
  console.log('\n[1/5] Semeando Usuários e Perfis de Acesso...');

  const usersData = [
    {
      email: 'admin@enterprise.io',
      role: 'ADMIN',
      firstAdmin: true,
      description: 'Super Administrador (firstAdmin garantido)',
    },
    {
      email: 'devops@enterprise.io',
      role: 'ADMIN',
      firstAdmin: null,
      description: 'DevOps & Site Reliability Engineer',
    },
    {
      email: 'architect@enterprise.io',
      role: 'USER',
      firstAdmin: null,
      description: 'Arquiteto de Software Principal',
    },
    {
      email: 'developer@enterprise.io',
      role: 'USER',
      firstAdmin: null,
      description: 'Desenvolvedor Fullstack Sênior',
    },
    {
      email: 'qa@enterprise.io',
      role: 'USER',
      firstAdmin: null,
      description: 'Engenheiro de Qualidade e Testes',
    },
    {
      email: 'auditor@enterprise.io',
      role: 'USER',
      firstAdmin: null,
      description: 'Auditor de Conformidade e Segurança',
    },
    {
      email: 'guest@enterprise.io',
      role: 'USER',
      firstAdmin: null,
      description: 'Usuário Padrão com Permissões Mínimas',
    },
  ];

  const seededUsers: Record<string, { id: number; email: string; role: string }> = {};

  for (const item of usersData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        role: item.role,
        passwordHash: hashedPassword,
      },
      create: {
        email: item.email,
        passwordHash: hashedPassword,
        role: item.role,
        firstAdmin: item.firstAdmin,
      },
    });
    seededUsers[item.email] = user;
    console.log(`  ✓ Usuário: ${user.email.padEnd(25)} [ID: ${user.id}, Role: ${user.role}] - ${item.description}`);
  }

  // --------------------------------------------------------------------------
  // 2. SESSÕES E TOKENS DE RENOVAÇÃO (REFRESH TOKENS & SESSION FAMILIES)
  // --------------------------------------------------------------------------
  console.log('\n[2/5] Semeando Sessões e Refresh Tokens (Cenários de Rotação e Revogação)...');

  // Limpa tokens antigos dos usuários semeados para reprodutibilidade
  const userIds = Object.values(seededUsers).map((u) => u.id);
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: userIds } },
  });

  const now = new Date();
  const futureExpiration = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias
  const pastExpiration = new Date(now.getTime() - 24 * 60 * 60 * 1000); // -1 dia (expirado)

  // Família Ativa: Admin logado com token ativo
  const adminFamily = randomUUID();
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      familyId: adminFamily,
      userId: seededUsers['admin@enterprise.io'].id,
      expiresAt: futureExpiration,
      revokedAt: null,
      createdAt: new Date(now.getTime() - 1000 * 60 * 30),
    },
  });

  // Família Rotacionada: Dev com token anterior revogado e token novo ativo
  const devFamily = randomUUID();
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      familyId: devFamily,
      userId: seededUsers['developer@enterprise.io'].id,
      expiresAt: futureExpiration,
      revokedAt: new Date(now.getTime() - 1000 * 60 * 10), // revogado há 10 min
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
    },
  });
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      familyId: devFamily,
      userId: seededUsers['developer@enterprise.io'].id,
      expiresAt: futureExpiration,
      revokedAt: null, // token corrente da sessão
      createdAt: new Date(now.getTime() - 1000 * 60 * 10),
    },
  });

  // Família Comprometida: Auditor com detecção de replay (sessão inteira revogada)
  const compromisedFamily = randomUUID();
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      familyId: compromisedFamily,
      userId: seededUsers['auditor@enterprise.io'].id,
      expiresAt: pastExpiration,
      revokedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48),
    },
  });

  console.log('  ✓ Família de sessão ativa provisionada para admin@enterprise.io');
  console.log('  ✓ Família com rotação bem-sucedida provisionada para developer@enterprise.io');
  console.log('  ✓ Família com token revogado/expirado provisionada para auditor@enterprise.io');

  // --------------------------------------------------------------------------
  // 3. LOGS DE SEGURANÇA E RATE LIMITING (LOGIN ATTEMPTS)
  // --------------------------------------------------------------------------
  console.log('\n[3/5] Semeando Registros de Rate Limiting e Tentativas de Login...');

  // Reset das chaves de teste
  const testKeys = [
    '127.0.0.1:admin@enterprise.io',
    '192.168.1.100:developer@enterprise.io',
    '203.0.113.42:hacker@external.net',
    '10.0.0.5:guest@enterprise.io',
  ];
  await prisma.loginAttempt.deleteMany({
    where: { key: { in: testKeys } },
  });

  const loginAttemptsData = [
    {
      key: '127.0.0.1:admin@enterprise.io',
      attempts: 1,
      resetAt: new Date(now.getTime() + 15 * 60 * 1000), // Válido por 15 min
      desc: 'Tentativa legítima de login com sucesso recente',
    },
    {
      key: '192.168.1.100:developer@enterprise.io',
      attempts: 3,
      resetAt: new Date(now.getTime() + 8 * 60 * 1000), // Próximo da janela
      desc: 'Múltiplas tentativas seguras em ambiente interno',
    },
    {
      key: '203.0.113.42:hacker@external.net',
      attempts: 5,
      resetAt: new Date(now.getTime() + 14 * 60 * 1000), // Bloqueado no limite
      desc: 'Tentativa de força bruta detectada e chave bloqueada no rate limit',
    },
    {
      key: '10.0.0.5:guest@enterprise.io',
      attempts: 2,
      resetAt: new Date(now.getTime() - 5 * 60 * 1000), // Janela já expirada
      desc: 'Janela vencida para testar limpeza automática periódica',
    },
  ];

  for (const item of loginAttemptsData) {
    await prisma.loginAttempt.create({
      data: {
        key: item.key,
        attempts: item.attempts,
        resetAt: item.resetAt,
      },
    });
    console.log(`  ✓ Rate Limit Key: ${item.key.padEnd(42)} [Tentativas: ${item.attempts}] - ${item.desc}`);
  }

  // --------------------------------------------------------------------------
  // 4. PROTÓTIPOS BASE E REFERÊNCIAS CIRCULARES (PROTOTYPE PATTERN)
  // --------------------------------------------------------------------------
  console.log('\n[4/5] Semeando Protótipos Canônicos e Referências Circulares...');

  // Limpeza prévia de revisões, referências e protótipos de teste
  await prisma.prototypeRevision.deleteMany({});
  await prisma.circularReference.deleteMany({});
  await prisma.prototype.deleteMany({});

  const basePrototypesData = [
    {
      name: 'API Gateway Ingress Proxy',
      primitive: 100,
      component: new Date('2026-01-15T08:00:00Z'),
      circularLabel: 'Gateway -> Service Mesh Loopback Proxy',
      version: 3,
    },
    {
      name: 'OAuth2 / OpenID Identity Provider',
      primitive: 200,
      component: new Date('2026-02-01T10:30:00Z'),
      circularLabel: 'Identity Provider -> Keycloak Cluster Mirror',
      version: 2,
    },
    {
      name: 'Distributed Event Bus Broker',
      primitive: 300,
      component: new Date('2026-03-10T14:15:00Z'),
      circularLabel: 'EventBus -> Dead Letter Queue Replay Channel',
      version: 3,
    },
    {
      name: 'High-Throughput Redis Cache Layer',
      primitive: 400,
      component: new Date('2026-04-05T09:00:00Z'),
      circularLabel: null,
      version: 1,
    },
    {
      name: 'Financial Ledger Transaction Reconciler',
      primitive: 500,
      component: new Date('2026-05-12T16:45:00Z'),
      circularLabel: 'Ledger Engine -> Double-Entry Audit Cycle',
      version: 2,
    },
  ];

  const createdPrototypes: Record<string, { id: number; name: string; version: number }> = {};

  for (const item of basePrototypesData) {
    const prototype = await prisma.prototype.create({
      data: {
        name: item.name,
        primitive: item.primitive,
        component: item.component,
        version: item.version,
        ...(item.circularLabel
          ? {
              circularReference: {
                create: {
                  label: item.circularLabel,
                },
              },
            }
          : {}),
      },
      include: {
        circularReference: true,
      },
    });

    createdPrototypes[item.name] = prototype;
    console.log(
      `  ✓ Protótipo Base #${prototype.id}: ${prototype.name.padEnd(45)} [v${prototype.version}, Ref: ${
        prototype.circularReference?.label ?? 'Nenhuma'
      }]`
    );
  }

  // --------------------------------------------------------------------------
  // 5. CLONES DE PROTÓTIPOS (LINHAGEM) E HISTÓRICO DE REVISÕES (EVENT SOURCING)
  // --------------------------------------------------------------------------
  console.log('\n[5/5] Semeando Clones Derivados (Linhagem) e Trilhas de Auditoria (PrototypeRevision)...');

  const clonesData = [
    {
      name: 'Staging API Gateway Ingress (US-East)',
      primitive: 101,
      component: new Date('2026-06-01T11:00:00Z'),
      parentKey: 'API Gateway Ingress Proxy',
      circularLabel: 'Staging Gateway -> US-East Mesh Loop',
      version: 2,
    },
    {
      name: 'Canary Identity Provider (EU-Central)',
      primitive: 201,
      component: new Date('2026-06-10T15:20:00Z'),
      parentKey: 'OAuth2 / OpenID Identity Provider',
      circularLabel: 'Canary IdP -> EU Keycloak Mirror',
      version: 1,
    },
    {
      name: 'Analytics Event Bus Read-Replica',
      primitive: 301,
      component: new Date('2026-06-15T09:40:00Z'),
      parentKey: 'Distributed Event Bus Broker',
      circularLabel: 'Analytics Bus -> Cold Storage Stream',
      version: 1,
    },
  ];

  for (const clone of clonesData) {
    const parent = createdPrototypes[clone.parentKey];
    const createdClone = await prisma.prototype.create({
      data: {
        name: clone.name,
        primitive: clone.primitive,
        component: clone.component,
        version: clone.version,
        clonedFromId: parent.id,
        ...(clone.circularLabel
          ? {
              circularReference: {
                create: {
                  label: clone.circularLabel,
                },
              },
            }
          : {}),
      },
      include: {
        circularReference: true,
      },
    });

    createdPrototypes[clone.name] = createdClone;
    console.log(
      `  ✓ Clone #${createdClone.id}: ${createdClone.name.padEnd(45)} [Derivado de #${parent.id} (${parent.name})]`
    );
  }

  // Criando revisões históricas (snapshots imutáveis) para rastreabilidade
  const revisionsData = [
    // Histórico do API Gateway Ingress Proxy (v1, v2, v3)
    {
      prototypeName: 'API Gateway Ingress Proxy',
      version: 1,
      name: 'API Gateway Ingress Proxy (Initial Spec)',
      primitive: 80,
      component: new Date('2026-01-10T00:00:00Z'),
      circularLabel: 'Gateway Initial Loopback',
      actorEmail: 'architect@enterprise.io',
      recordedAt: new Date('2026-01-10T00:00:00Z'),
    },
    {
      prototypeName: 'API Gateway Ingress Proxy',
      version: 2,
      name: 'API Gateway Ingress Proxy (Performance Tuning)',
      primitive: 95,
      component: new Date('2026-01-12T12:00:00Z'),
      circularLabel: 'Gateway -> Service Mesh Loopback v2',
      actorEmail: 'developer@enterprise.io',
      recordedAt: new Date('2026-01-12T12:00:00Z'),
    },
    {
      prototypeName: 'API Gateway Ingress Proxy',
      version: 3,
      name: 'API Gateway Ingress Proxy',
      primitive: 100,
      component: new Date('2026-01-15T08:00:00Z'),
      circularLabel: 'Gateway -> Service Mesh Loopback Proxy',
      actorEmail: 'devops@enterprise.io',
      recordedAt: new Date('2026-01-15T08:00:00Z'),
    },
    // Histórico do OAuth2 / OpenID Identity Provider (v1, v2)
    {
      prototypeName: 'OAuth2 / OpenID Identity Provider',
      version: 1,
      name: 'OAuth2 / OpenID Identity Provider (Alpha)',
      primitive: 180,
      component: new Date('2026-01-20T10:00:00Z'),
      circularLabel: 'Identity Provider -> Keycloak Alpha',
      actorEmail: 'architect@enterprise.io',
      recordedAt: new Date('2026-01-20T10:00:00Z'),
    },
    {
      prototypeName: 'OAuth2 / OpenID Identity Provider',
      version: 2,
      name: 'OAuth2 / OpenID Identity Provider',
      primitive: 200,
      component: new Date('2026-02-01T10:30:00Z'),
      circularLabel: 'Identity Provider -> Keycloak Cluster Mirror',
      actorEmail: 'admin@enterprise.io',
      recordedAt: new Date('2026-02-01T10:30:00Z'),
    },
    // Histórico do Staging API Gateway Ingress (v1, v2)
    {
      prototypeName: 'Staging API Gateway Ingress (US-East)',
      version: 1,
      name: 'Staging API Gateway Ingress (US-East) - Draft',
      primitive: 99,
      component: new Date('2026-05-20T08:00:00Z'),
      circularLabel: 'Staging Gateway -> US-East Mesh Loop Draft',
      actorEmail: 'qa@enterprise.io',
      recordedAt: new Date('2026-05-20T08:00:00Z'),
    },
    {
      prototypeName: 'Staging API Gateway Ingress (US-East)',
      version: 2,
      name: 'Staging API Gateway Ingress (US-East)',
      primitive: 101,
      component: new Date('2026-06-01T11:00:00Z'),
      circularLabel: 'Staging Gateway -> US-East Mesh Loop',
      actorEmail: 'developer@enterprise.io',
      recordedAt: new Date('2026-06-01T11:00:00Z'),
    },
  ];

  for (const rev of revisionsData) {
    const proto = createdPrototypes[rev.prototypeName];
    const actor = seededUsers[rev.actorEmail];

    await prisma.prototypeRevision.create({
      data: {
        prototypeId: proto.id,
        version: rev.version,
        name: rev.name,
        primitive: rev.primitive,
        component: rev.component,
        circularReferenceLabel: rev.circularLabel,
        actorId: actor?.id ?? null,
        recordedAt: rev.recordedAt,
      },
    });
    console.log(
      `  ✓ Revisão gravada: Protótipo #${proto.id} v${rev.version} (Autor: ${rev.actorEmail}) [Snapshot: "${rev.name}"]`
    );
  }

  // --------------------------------------------------------------------------
  // RESUMO ESTATÍSTICO DO SEED
  // --------------------------------------------------------------------------
  const [totalUsers, totalTokens, totalAttempts, totalPrototypes, totalCircular, totalRevisions] =
    await Promise.all([
      prisma.user.count(),
      prisma.refreshToken.count(),
      prisma.loginAttempt.count(),
      prisma.prototype.count(),
      prisma.circularReference.count(),
      prisma.prototypeRevision.count(),
    ]);

  console.log('\n====================================================');
  console.log('✨ SEED CONCLUÍDO COM SUCESSO! RESUMO DO BANCO:');
  console.log('====================================================');
  console.log(`  👥 Total de Usuários:            ${totalUsers}`);
  console.log(`  🔑 Total de Refresh Tokens:       ${totalTokens}`);
  console.log(`  🛡️  Registros de Rate Limit:      ${totalAttempts}`);
  console.log(`  📦 Total de Protótipos:           ${totalPrototypes} (incluindo clones e linhagens)`);
  console.log(`  🔄 Referências Circulares:        ${totalCircular}`);
  console.log(`  📜 Snapshots de Auditoria (Rev):  ${totalRevisions}`);
  console.log('====================================================\n');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Erro durante execução do seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import { createTemplateRegistry } from '../prototypes/prototype-templates';

/**
 * Popula um banco vazio com um registro por modelo do catálogo.
 * Se já houver protótipos, não faz nada (pode ser executado mais de uma vez).
 */
async function seed(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    if ((await prisma.prototype.count()) > 0) {
      console.log('O banco já possui protótipos; seed ignorado.');
      return;
    }
    const templates = createTemplateRegistry();
    for (const key of templates.keys()) {
      const created = await prisma.prototype.create({
        data: templates.create(key).toCreateInput(),
      });
      console.log(`Criado o protótipo #${created.id}: ${created.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

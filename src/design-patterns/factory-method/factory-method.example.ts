import type { Log } from '../log';
import type { NotificationChannel } from './notifier';
import { createNotifier } from './notifier';

export function runFactoryMethodExample(log: Log = console.log): void {
  const preferences: [NotificationChannel, string][] = [
    ['email', 'ana@exemplo.com'],
    ['sms', '+55 11 90000-0000'],
  ];

  log('--- Factory Method ---');
  for (const [channel, target] of preferences) {
    // O laço não sabe qual classe de transporte é criada: só chama `notify`.
    const notifier = createNotifier(channel, target);
    const receipt = notifier.notify('  Seu pedido saiu para entrega. ');
    log(`Canal ${notifier.create().channel}: ${receipt}`);
  }

  const sms = createNotifier('sms', '+55 11 90000-0000');
  const longReceipt = sms.notify('x'.repeat(500));
  const kept = longReceipt.length - '[sms para +55 11 90000-0000] '.length;
  log(`O SMS corta o excedente: ${kept} letras`);
  log(`Cada create() devolve um transporte novo: ${sms.create() !== sms.create()}`);
}

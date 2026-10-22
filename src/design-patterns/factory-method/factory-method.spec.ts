import type { Creator } from './creator';
import type { Transport } from './notifier';
import { createNotifier, EmailNotifier, Notifier, SmsNotifier } from './notifier';

describe('Notifier (Factory Method)', () => {
  it('cada subclasse cria o seu produto concreto', () => {
    expect(new EmailNotifier('ana@exemplo.com').create().channel).toBe('email');
    expect(new SmsNotifier('+5511900000000').create().channel).toBe('sms');
  });

  it('o método de fábrica devolve um produto novo a cada chamada', () => {
    const notifier = new EmailNotifier('ana@exemplo.com');

    expect(notifier.create()).not.toBe(notifier.create());
  });

  it('notify usa o produto criado pela subclasse e guarda o comprovante', () => {
    const email = new EmailNotifier('ana@exemplo.com');
    const sms = new SmsNotifier('+5511900000000');

    expect(email.notify('Olá')).toBe('[email para ana@exemplo.com] Olá');
    expect(sms.notify('Olá')).toBe('[sms para +5511900000000] Olá');
    expect(email.sent).toEqual(['[email para ana@exemplo.com] Olá']);
    expect(sms.sent).toHaveLength(1);
  });

  it('remove os espaços das pontas e recusa mensagem vazia', () => {
    const notifier = new EmailNotifier('ana@exemplo.com');

    expect(notifier.notify('  oi  ')).toBe('[email para ana@exemplo.com] oi');
    expect(() => notifier.notify('   ')).toThrow(RangeError);
    expect(notifier.sent).toHaveLength(1);
  });

  it('o SMS corta a mensagem em 160 caracteres; o e-mail não', () => {
    const long = 'a'.repeat(200);

    expect(new SmsNotifier('1').notify(long)).toBe(`[sms para 1] ${'a'.repeat(160)}`);
    expect(new EmailNotifier('b@c.d').notify(long)).toBe(`[email para b@c.d] ${long}`);
  });

  it('o corte do SMS não parte um emoji ao meio', () => {
    const emojis = '😀'.repeat(200);

    expect(new SmsNotifier('1').notify(emojis)).toBe(`[sms para 1] ${'😀'.repeat(160)}`);
  });

  it('aceita um criador novo sem alterar a lógica de notify', () => {
    const delivered: string[] = [];
    class MemoryNotifier extends Notifier {
      override create(): Transport {
        return {
          channel: 'memória',
          deliver: (message) => {
            delivered.push(message);
            return `ok: ${message}`;
          },
        };
      }
    }

    const notifier = new MemoryNotifier();

    expect(notifier.notify('teste')).toBe('ok: teste');
    expect(delivered).toEqual(['teste']);
  });

  it('pode ser usado apenas pelo contrato genérico Creator<T>', () => {
    const creators: Creator<Transport>[] = [new EmailNotifier('a@b.c'), new SmsNotifier('1')];

    expect(creators.map((creator) => creator.create().channel)).toEqual(['email', 'sms']);
  });
});

describe('createNotifier', () => {
  it('escolhe o criador pelo canal informado em tempo de execução', () => {
    expect(createNotifier('email', 'a@b.c')).toBeInstanceOf(EmailNotifier);
    expect(createNotifier('sms', '1')).toBeInstanceOf(SmsNotifier);
  });
});

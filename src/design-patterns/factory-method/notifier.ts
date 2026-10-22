import type { Creator } from './creator';

/** Produto: um canal capaz de entregar uma mensagem e devolver o comprovante. */
export interface Transport {
  readonly channel: string;
  deliver(message: string): string;
}

class EmailTransport implements Transport {
  readonly channel = 'email';

  constructor(private readonly address: string) {}

  deliver(message: string): string {
    return `[email para ${this.address}] ${message}`;
  }
}

const SMS_MAX_LENGTH = 160;

class SmsTransport implements Transport {
  readonly channel = 'sms';

  constructor(private readonly phone: string) {}

  /**
   * Um SMS tem tamanho limitado: o excedente é cortado. Conta caracteres, não
   * unidades UTF-16, para não partir um emoji ao meio.
   */
  deliver(message: string): string {
    return `[sms para ${this.phone}] ${[...message].slice(0, SMS_MAX_LENGTH).join('')}`;
  }
}

/**
 * Criador abstrato. `notify` é a lógica comum, que só conhece a interface
 * `Transport`; o método de fábrica `create` é deixado para as subclasses.
 */
export abstract class Notifier implements Creator<Transport> {
  /** Comprovantes das mensagens já enviadas por este notificador. */
  readonly sent: string[] = [];

  /** O método de fábrica: cada subclasse devolve o seu produto concreto. */
  abstract create(): Transport;

  notify(message: string): string {
    const text = message.trim();
    if (text === '') {
      throw new RangeError('A mensagem não pode ser vazia.');
    }
    const receipt = this.create().deliver(text);
    this.sent.push(receipt);
    return receipt;
  }
}

export class EmailNotifier extends Notifier {
  constructor(private readonly address: string) {
    super();
  }

  override create(): Transport {
    return new EmailTransport(this.address);
  }
}

export class SmsNotifier extends Notifier {
  constructor(private readonly phone: string) {
    super();
  }

  override create(): Transport {
    return new SmsTransport(this.phone);
  }
}

export type NotificationChannel = 'email' | 'sms';

/**
 * Fábrica parametrizada: escolhe o criador a partir de um dado conhecido só em
 * tempo de execução (uma preferência do usuário, por exemplo).
 */
export function createNotifier(channel: NotificationChannel, target: string): Notifier {
  switch (channel) {
    case 'email':
      return new EmailNotifier(target);
    case 'sms':
      return new SmsNotifier(target);
  }
}

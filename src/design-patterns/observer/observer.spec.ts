import { EventSubject } from './event-subject';
import type { Observer } from './observer';
import { OverheatAlarm, Thermostat } from './thermostat';

describe('EventSubject', () => {
  it('avisa objetos e funções, na ordem de inscrição', () => {
    const subject = new EventSubject<string>();
    const calls: string[] = [];
    const observer: Observer<string> = { update: (event) => calls.push(`objeto:${event}`) };

    subject.subscribe(observer);
    subject.subscribe((event) => calls.push(`função:${event}`));
    subject.notify('a');

    expect(calls).toEqual(['objeto:a', 'função:a']);
  });

  it('não faz nada quando não há observadores', () => {
    const subject = new EventSubject<number>();

    expect(() => subject.notify(1)).not.toThrow();
    expect(subject.size).toBe(0);
  });

  it('para de avisar depois do cancelamento, que pode ser repetido sem efeito', () => {
    const subject = new EventSubject<number>();
    const received: number[] = [];
    const unsubscribe = subject.subscribe((event) => received.push(event));

    subject.notify(1);
    unsubscribe();
    unsubscribe();
    subject.notify(2);

    expect(received).toEqual([1]);
    expect(subject.size).toBe(0);
  });

  it('não avisa em dobro o mesmo objeto inscrito duas vezes', () => {
    const subject = new EventSubject<number>();
    const received: number[] = [];
    const observer: Observer<number> = { update: (event) => received.push(event) };

    subject.subscribe(observer);
    subject.subscribe(observer);
    subject.notify(7);

    expect(received).toEqual([7]);
    expect(subject.size).toBe(1);
  });

  it('não avisa em dobro a mesma função inscrita duas vezes', () => {
    const subject = new EventSubject<number>();
    const received: number[] = [];
    const listener = (event: number) => received.push(event);

    subject.subscribe(listener);
    const unsubscribe = subject.subscribe(listener);
    subject.notify(7);
    unsubscribe();
    subject.notify(8);

    expect(received).toEqual([7]);
    expect(subject.size).toBe(0);
  });

  it('cancelar a própria inscrição durante o aviso não pula o observador seguinte', () => {
    const subject = new EventSubject<string>();
    const calls: string[] = [];
    const unsubscribeFirst = subject.subscribe(() => {
      calls.push('primeiro');
      unsubscribeFirst();
    });
    subject.subscribe(() => calls.push('segundo'));

    subject.notify('x');
    subject.notify('y');

    expect(calls).toEqual(['primeiro', 'segundo', 'segundo']);
  });

  it('quem se inscreve durante o aviso só recebe o próximo evento', () => {
    const subject = new EventSubject<number>();
    const late: number[] = [];
    let subscribed = false;
    subject.subscribe(() => {
      if (!subscribed) {
        subscribed = true;
        subject.subscribe((event) => late.push(event));
      }
    });

    subject.notify(1);
    subject.notify(2);

    expect(late).toEqual([2]);
  });

  it('não avisa um observador cancelado por outro na mesma rodada', () => {
    const subject = new EventSubject<number>();
    const received: number[] = [];
    const cancel: { second?: () => void } = {};
    subject.subscribe(() => cancel.second?.());
    cancel.second = subject.subscribe((event) => received.push(event));

    subject.notify(1);

    expect(received).toEqual([]);
  });

  it('mantém listas de observadores independentes por sujeito', () => {
    const first = new EventSubject<number>();
    const second = new EventSubject<number>();
    const received: number[] = [];
    first.subscribe((event) => received.push(event));

    second.notify(1);

    expect(received).toEqual([]);
  });
});

describe('Thermostat e OverheatAlarm', () => {
  it('publica a leitura com o valor anterior', () => {
    const thermostat = new Thermostat();
    const readings: unknown[] = [];
    thermostat.readings.subscribe((reading) => readings.push(reading));

    thermostat.setTemperature(20);
    thermostat.setTemperature(25);

    expect(readings).toEqual([
      { celsius: 20, previous: null },
      { celsius: 25, previous: 20 },
    ]);
  });

  it('não publica quando a temperatura não muda', () => {
    const thermostat = new Thermostat();
    let count = 0;
    thermostat.readings.subscribe(() => count++);

    thermostat.setTemperature(20);
    thermostat.setTemperature(20);

    expect(count).toBe(1);
  });

  it('o alarme só registra leituras acima do limite', () => {
    const thermostat = new Thermostat();
    const alarm = new OverheatAlarm(30);
    thermostat.readings.subscribe(alarm);

    thermostat.setTemperature(30);
    thermostat.setTemperature(31);

    expect(alarm.alerts).toEqual(['ALERTA: 31 °C passa do limite de 30 °C']);
  });
});

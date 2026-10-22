import { TypedDomainEventBus, domainEventBus } from './domain-event-bus';

describe('TypedDomainEventBus (Observer Pattern)', () => {
  let bus: TypedDomainEventBus;

  beforeEach(() => {
    bus = new TypedDomainEventBus({ maxHistorySize: 10 });
  });

  it('deve inscrever e receber evento tipado publicado com publish()', async () => {
    const received: any[] = [];
    bus.subscribe('prototype.created', (event) => {
      received.push(event);
    });

    const event = await bus.publish('prototype.created', {
      id: 1,
      name: 'Protótipo Alpha',
      primitive: 42,
      actorId: 10,
    });

    expect(received).toHaveLength(1);
    expect(received[0].eventName).toBe('prototype.created');
    expect(received[0].payload.name).toBe('Protótipo Alpha');
    expect(received[0].eventId).toBeDefined();
    expect(received[0].occurredOn).toBeInstanceOf(Date);
    expect(event).toBe(received[0]);
  });

  it('deve cancelar inscrição com unsubscribe', async () => {
    let callCount = 0;
    const unsub = bus.subscribe('prototype.deleted', () => {
      callCount++;
    });

    await bus.publish('prototype.deleted', { id: 99 });
    expect(callCount).toBe(1);

    unsub();
    await bus.publish('prototype.deleted', { id: 100 });
    expect(callCount).toBe(1);
  });

  it('deve notificar listeners wildcard para qualquer tipo de evento', async () => {
    const wildcardEvents: string[] = [];
    bus.subscribeAll((event) => {
      wildcardEvents.push(event.eventName);
    });

    await bus.publish('prototype.created', { id: 1, name: 'T1', primitive: 1, actorId: 1 });
    await bus.publish('fine.calculated', {
      strategy: 'linear',
      originalAmount: 100,
      totalFine: 5,
      overdueDays: 10,
    });

    expect(wildcardEvents).toEqual(['prototype.created', 'fine.calculated']);
  });

  it('deve publicar de forma síncrona com publishSync()', () => {
    let handled = false;
    bus.subscribe('user.registered', (event) => {
      handled = true;
      expect(event.payload.email).toBe('user@test.com');
    });

    bus.publishSync('user.registered', {
      userId: 5,
      email: 'user@test.com',
      role: 'USER',
    });

    expect(handled).toBe(true);
  });

  it('deve manter histórico e respeitar limite máximo de tamanho', async () => {
    for (let i = 1; i <= 15; i++) {
      await bus.publish('prototype.deleted', { id: i });
    }

    const history = bus.getHistory();
    expect(history.length).toBe(10);
    expect(history[0].payload.id).toBe(6);
    expect(history[history.length - 1].payload.id).toBe(15);

    const filtered = bus.getHistory('prototype.deleted');
    expect(filtered.length).toBe(10);

    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });

  it('não deve propagar exceções de um listener para outros ouvintes', async () => {
    let secondCalled = false;
    bus.subscribe('prototype.created', () => {
      throw new Error('Falha no primeiro handler');
    });
    bus.subscribe('prototype.created', () => {
      secondCalled = true;
    });

    await expect(
      bus.publish('prototype.created', { id: 1, name: 'X', primitive: 0, actorId: 1 }),
    ).resolves.toBeDefined();

    expect(secondCalled).toBe(true);
  });

  it('a instância global domainEventBus deve estar definida', () => {
    expect(domainEventBus).toBeInstanceOf(TypedDomainEventBus);
  });
});

import { domainEventBus } from '../design-patterns/observer/domain-event-bus';
import { MetricsService } from './metrics.service';

describe('MetricsService (Prometheus & JSON export)', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it('deve registrar requisição HTTP e exportar formato Prometheus', () => {
    service.recordHttpRequest('GET', '/prototypes', 200, 45.5);
    service.recordHttpRequest('POST', '/prototypes', 201, 120.0);

    const prometheus = service.toPrometheusFormat();

    expect(prometheus).toContain('process_uptime_seconds');
    expect(prometheus).toContain('process_resident_memory_bytes');
    expect(prometheus).toContain('http_requests_total{method="GET",path="/prototypes",status="200"} 1');
    expect(prometheus).toContain('http_requests_total{method="POST",path="/prototypes",status="201"} 1');
    expect(prometheus).toContain('http_request_duration_seconds_count{method="GET",path="/prototypes"} 1');
  });

  it('deve exportar formato JSON estruturado com métricas detalhadas', () => {
    service.recordHttpRequest('GET', '/prototypes/123', 200, 30.0);

    const json = service.toJsonFormat();

    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
    expect(json.system.memory.rssMb).toBeGreaterThan(0);
    expect(json.metrics.httpRequestsTotal['GET:/prototypes/:id:200']).toBe(1);
    expect(json.metrics.httpPerformance['GET:/prototypes/:id'].count).toBe(1);
  });

  it('deve registrar eventos de domínio automaticamente ao serem publicados no event bus', async () => {
    await domainEventBus.publish('prototype.created', {
      id: 99,
      name: 'EventTest',
      primitive: 10,
      actorId: 1,
    });

    const json = service.toJsonFormat();
    expect(json.metrics.domainEventsPublished['prototype.created']).toBeGreaterThanOrEqual(1);

    const prometheus = service.toPrometheusFormat();
    expect(prometheus).toContain('domain_events_published_total{event="prototype.created"}');
  });

  it('deve registrar cálculos de multa progressiva', () => {
    service.recordFineCalculation('LinearOverdueFineStrategy');
    service.recordFineCalculation('TieredProgressiveFineStrategy');

    const json = service.toJsonFormat();
    expect(json.metrics.fineCalculationsTotal['LinearOverdueFineStrategy']).toBe(1);
    expect(json.metrics.fineCalculationsTotal['TieredProgressiveFineStrategy']).toBe(1);

    const prometheus = service.toPrometheusFormat();
    expect(prometheus).toContain('fines_calculated_total{strategy="LinearOverdueFineStrategy"} 1');
  });
});

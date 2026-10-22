import { Injectable, OnModuleInit } from '@nestjs/common';
import { domainEventBus } from '../design-patterns/observer/domain-event-bus';

export interface HttpRequestMetricKey {
  method: string;
  path: string;
  status: number;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly startTime = Date.now();
  private readonly httpRequestsTotal = new Map<string, number>();
  private readonly httpDurations = new Map<string, { count: number; sumSec: number }>();
  private readonly domainEventsCount = new Map<string, number>();
  private readonly fineCalculationsCount = new Map<string, number>();

  onModuleInit(): void {
    // Escuta todos os eventos de domínio para alimentar métricas automaticamente
    domainEventBus.subscribeAll((event) => {
      this.recordDomainEvent(event.eventName);
      if (event.eventName === 'fine.calculated') {
        const payload = event.payload as { strategy?: string };
        if (payload?.strategy) {
          this.recordFineCalculation(payload.strategy);
        }
      }
    });
  }

  recordHttpRequest(method: string, path: string, status: number, durationMs: number): void {
    const normalizedPath = this.normalizePath(path);
    const key = `${method.toUpperCase()}:${normalizedPath}:${status}`;
    this.httpRequestsTotal.set(key, (this.httpRequestsTotal.get(key) ?? 0) + 1);

    const durKey = `${method.toUpperCase()}:${normalizedPath}`;
    const prev = this.httpDurations.get(durKey) ?? { count: 0, sumSec: 0 };
    this.httpDurations.set(durKey, {
      count: prev.count + 1,
      sumSec: prev.sumSec + durationMs / 1000,
    });
  }

  recordDomainEvent(eventName: string): void {
    this.domainEventsCount.set(
      eventName,
      (this.domainEventsCount.get(eventName) ?? 0) + 1,
    );
  }

  recordFineCalculation(strategyName: string): void {
    this.fineCalculationsCount.set(
      strategyName,
      (this.fineCalculationsCount.get(strategyName) ?? 0) + 1,
    );
  }

  /**
   * Converte as métricas coletadas para o formato padrão do Prometheus (OpenMetrics/text/plain).
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const memory = process.memoryUsage();

    lines.push('# HELP process_uptime_seconds Tempo de atividade do processo em segundos.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${uptimeSec}`);

    lines.push('# HELP process_resident_memory_bytes Memória residente (RSS) utilizada pelo processo Node.js.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${memory.rss}`);

    lines.push('# HELP nodejs_heap_size_total_bytes Tamanho total do heap do V8 em bytes.');
    lines.push('# TYPE nodejs_heap_size_total_bytes gauge');
    lines.push(`nodejs_heap_size_total_bytes ${memory.heapTotal}`);

    lines.push('# HELP nodejs_heap_size_used_bytes Memória heap do V8 em uso em bytes.');
    lines.push('# TYPE nodejs_heap_size_used_bytes gauge');
    lines.push(`nodejs_heap_size_used_bytes ${memory.heapUsed}`);

    lines.push('# HELP http_requests_total Total de requisições HTTP recebidas por método, rota e código de status.');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of this.httpRequestsTotal) {
      const [method, route, status] = key.split(':');
      lines.push(`http_requests_total{method="${method}",path="${route}",status="${status}"} ${count}`);
    }

    lines.push('# HELP http_request_duration_seconds_sum Soma da duração das requisições HTTP em segundos.');
    lines.push('# TYPE http_request_duration_seconds_sum counter');
    for (const [key, dur] of this.httpDurations) {
      const [method, route] = key.split(':');
      lines.push(`http_request_duration_seconds_sum{method="${method}",path="${route}"} ${dur.sumSec.toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{method="${method}",path="${route}"} ${dur.count}`);
    }

    lines.push('# HELP domain_events_published_total Total de eventos de domínio publicados no EventBus.');
    lines.push('# TYPE domain_events_published_total counter');
    for (const [eventName, count] of this.domainEventsCount) {
      lines.push(`domain_events_published_total{event="${eventName}"} ${count}`);
    }

    lines.push('# HELP fines_calculated_total Total de cálculos de multas progressivas executados por estratégia.');
    lines.push('# TYPE fines_calculated_total counter');
    for (const [strategy, count] of this.fineCalculationsCount) {
      lines.push(`fines_calculated_total{strategy="${strategy}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Retorna representação estruturada em JSON das métricas da aplicação.
   */
  toJsonFormat(): Record<string, any> {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const memory = process.memoryUsage();

    const httpRequests: Record<string, number> = {};
    for (const [k, v] of this.httpRequestsTotal) {
      httpRequests[k] = v;
    }

    const httpPerformance: Record<string, { count: number; totalDurationSec: number; avgDurationMs: number }> = {};
    for (const [k, v] of this.httpDurations) {
      httpPerformance[k] = {
        count: v.count,
        totalDurationSec: Number(v.sumSec.toFixed(4)),
        avgDurationMs: v.count > 0 ? Number(((v.sumSec / v.count) * 1000).toFixed(2)) : 0,
      };
    }

    const domainEvents: Record<string, number> = {};
    for (const [k, v] of this.domainEventsCount) {
      domainEvents[k] = v;
    }

    const fineCalculations: Record<string, number> = {};
    for (const [k, v] of this.fineCalculationsCount) {
      fineCalculations[k] = v;
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: uptimeSec,
      system: {
        memory: {
          rssMb: Number((memory.rss / (1024 * 1024)).toFixed(2)),
          heapTotalMb: Number((memory.heapTotal / (1024 * 1024)).toFixed(2)),
          heapUsedMb: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
          externalMb: Number((memory.external / (1024 * 1024)).toFixed(2)),
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
      metrics: {
        httpRequestsTotal: httpRequests,
        httpPerformance,
        domainEventsPublished: domainEvents,
        fineCalculationsTotal: fineCalculations,
      },
    };
  }

  private normalizePath(path: string): string {
    const clean = path.split('?')[0] ?? '';
    return clean.replace(/\/\d+/g, '/:id');
  }
}

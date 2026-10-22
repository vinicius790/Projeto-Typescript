import type { Log } from '../log';
import { CachingOrderServiceDecorator } from './caching-order-service.decorator';
import { BaseOrderService } from './decorator';
import { LoggingOrderServiceDecorator } from './logging-order-service.decorator';
import { PerformanceOrderServiceDecorator } from './performance-order-service.decorator';

export function runDecoratorExample(log: Log = console.log): void {
  log('--- Decorator ---');

  // 1. Componente base
  const baseService = new BaseOrderService();

  // 2. Composição encadeada de decorators:
  // Base -> Cache -> Performance -> Logging
  const cachingService = new CachingOrderServiceDecorator(baseService);
  const performanceService = new PerformanceOrderServiceDecorator(cachingService);
  const decoratedService = new LoggingOrderServiceDecorator(performanceService, (msg) =>
    log(msg),
  );

  // Estatísticas iniciais emitidas sincronicamente para demonstração imediata
  const initialCache = cachingService.getStats();
  const initialMetrics = performanceService.getMetrics();
  log(
    `Estatísticas de Cache: ${initialCache.hits} hits, ${initialCache.misses} misses (tamanho: ${initialCache.size})`,
  );
  log(
    `Métricas de Performance: getOrderById chamadas=${initialMetrics.getOrderById?.callCount || 0}, média=${initialMetrics.getOrderById?.avgDurationMs || 0}ms`,
  );

  // Executa criação de pedido assíncrono
  decoratedService
    .createOrder({
      customerEmail: 'arquiteto@empresa.com',
      items: [
        { name: 'Licença Enterprise', quantity: 2, unitPrice: 2500 },
        { name: 'Suporte 24/7', quantity: 1, unitPrice: 1200 },
      ],
    })
    .then((order) => {
      // Primeira busca: cache miss
      return decoratedService.getOrderById(order.id).then(() => {
        // Segunda busca: cache hit imediato
        return decoratedService.getOrderById(order.id);
      });
    })
    .then(() => {
      const metrics = performanceService.getMetrics();
      const cacheStats = cachingService.getStats();

      log(
        `Estatísticas de Cache Atualizadas: ${cacheStats.hits} hits, ${cacheStats.misses} misses (tamanho: ${cacheStats.size})`,
      );
      log(
        `Métricas de Performance Atualizadas: getOrderById chamadas=${metrics.getOrderById?.callCount || 0}, média=${metrics.getOrderById?.avgDurationMs || 0}ms`,
      );
    });
}

import { CachingOrderServiceDecorator } from './caching-order-service.decorator';
import { BaseOrderService } from './decorator';
import { LoggingOrderServiceDecorator } from './logging-order-service.decorator';
import { PerformanceOrderServiceDecorator } from './performance-order-service.decorator';

describe('Padrão GoF Decorator - Serviços de Pedidos', () => {
  const sampleDto = {
    customerEmail: 'teste@dev.com',
    items: [
      { name: 'Teclado Mecânico', quantity: 1, unitPrice: 350 },
      { name: 'Mouse Sem Fio', quantity: 2, unitPrice: 150 },
    ],
  };

  describe('BaseOrderService', () => {
    it('cria pedido com ID e valor total correto', async () => {
      const service = new BaseOrderService();
      const order = await service.createOrder(sampleDto);

      expect(order.id).toMatch(/^ord_/);
      expect(order.total).toBe(650);
      expect(order.items).toHaveLength(2);
      expect(await service.getOrderById(order.id)).toEqual(order);
    });

    it('rejeita pedido com dados incompletos', async () => {
      const service = new BaseOrderService();
      await expect(service.createOrder({ customerEmail: '', items: [] })).rejects.toThrow(
        /informe e-mail e ao menos um item/,
      );
    });
  });

  describe('LoggingOrderServiceDecorator', () => {
    it('registra logs de sucesso e tempo de execução', async () => {
      const base = new BaseOrderService();
      const logs: string[] = [];
      const decorator = new LoggingOrderServiceDecorator(base, (msg) => logs.push(msg));

      const order = await decorator.createOrder(sampleDto);
      await decorator.getOrderById(order.id);
      await decorator.listOrders();

      expect(logs.some((l) => l.includes('Iniciando createOrder'))).toBe(true);
      expect(logs.some((l) => l.includes('createOrder concluído com sucesso'))).toBe(true);
      expect(logs.some((l) => l.includes('Buscando pedido ID'))).toBe(true);
      expect(logs.some((l) => l.includes('listOrders concluído'))).toBe(true);
    });

    it('registra falhas quando o serviço base lança exceção', async () => {
      const base = new BaseOrderService();
      const logs: string[] = [];
      const decorator = new LoggingOrderServiceDecorator(base, (msg) => logs.push(msg));

      await expect(decorator.createOrder({ customerEmail: '', items: [] })).rejects.toThrow();
      expect(logs.some((l) => l.includes('Falha em createOrder'))).toBe(true);
    });
  });

  describe('PerformanceOrderServiceDecorator', () => {
    it('coleta métricas de telemetria e calcula tempo médio', async () => {
      const base = new BaseOrderService();
      const decorator = new PerformanceOrderServiceDecorator(base);

      const order = await decorator.createOrder(sampleDto);
      await decorator.getOrderById(order.id);
      await decorator.getOrderById(order.id);

      const metrics = decorator.getMetrics();

      expect(metrics.createOrder.callCount).toBe(1);
      expect(metrics.createOrder.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(metrics.getOrderById.callCount).toBe(2);
      expect(metrics.getOrderById.avgDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('permite redefinir métricas com resetMetrics', async () => {
      const base = new BaseOrderService();
      const decorator = new PerformanceOrderServiceDecorator(base);
      await decorator.createOrder(sampleDto);
      decorator.resetMetrics();

      expect(decorator.getMetrics()).toEqual({});
    });
  });

  describe('CachingOrderServiceDecorator', () => {
    it('evita buscas repetidas contabilizando hits e misses de cache', async () => {
      const base = new BaseOrderService();
      const spy = jest.spyOn(base, 'getOrderById');
      const decorator = new CachingOrderServiceDecorator(base);

      const order = await base.createOrder(sampleDto);

      // 1ª busca: miss no cache, consulta o base service
      const res1 = await decorator.getOrderById(order.id);
      expect(res1).toEqual(order);
      expect(spy).toHaveBeenCalledTimes(1);

      // 2ª busca: hit no cache, base service não é chamado novamente
      const res2 = await decorator.getOrderById(order.id);
      expect(res2).toEqual(order);
      expect(spy).toHaveBeenCalledTimes(1);

      const stats = decorator.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('limpa o cache quando solicitado', async () => {
      const base = new BaseOrderService();
      const decorator = new CachingOrderServiceDecorator(base);
      const order = await decorator.createOrder(sampleDto);

      decorator.clearCache();
      expect(decorator.getStats().size).toBe(0);
    });
  });

  describe('Composição encadeada de múltiplos Decorators', () => {
    it('executa perfeitamente com Logging + Performance + Caching', async () => {
      const base = new BaseOrderService();
      const logs: string[] = [];
      const caching = new CachingOrderServiceDecorator(base);
      const performance = new PerformanceOrderServiceDecorator(caching);
      const logging = new LoggingOrderServiceDecorator(performance, (m) => logs.push(m));

      const order = await logging.createOrder(sampleDto);
      expect(order.id).toBeDefined();

      const found = await logging.getOrderById(order.id);
      expect(found).toEqual(order);

      // Verifica que logs e métricas foram preenchidos
      expect(logs.length).toBeGreaterThan(0);
      expect(performance.getMetrics().createOrder.callCount).toBe(1);
      expect(caching.getStats().size).toBeGreaterThan(0);
    });
  });
});

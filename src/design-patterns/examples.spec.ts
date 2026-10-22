import { runAllPatternExamples } from './examples';

describe('exemplos executáveis dos padrões', () => {
  it('não imprimem nada ao serem importados', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./examples');
      });
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('rodam até o fim, na ordem, e demonstram o comportamento esperado', () => {
    const lines: string[] = [];

    runAllPatternExamples((line) => lines.push(line));

    expect(lines.filter((line) => line.startsWith('---'))).toEqual([
      '--- Builder ---',
      '--- Factory Method ---',
      '--- Abstract Factory ---',
      '--- Observer ---',
      '--- Strategy ---',
      '--- Adapter ---',
      '--- Decorator ---',
      '--- Chain of Responsibility ---',
      '--- State Pattern ---',
    ]);
    expect(lines).toContain(
      'Passo a passo: GET https://api.exemplo.com/produtos?categoria=livros&pagina=2 (limite de 5000 ms)',
    );
    expect(lines).toContain(
      'Montagem recusada: URL inválida: "endereço inválido"; requisição GET não pode ter corpo',
    );
    expect(lines).toContain(
      'Canal sms: [sms para +55 11 90000-0000] Seu pedido saiu para entrega.',
    );
    expect(lines).toContain('O SMS corta o excedente: 160 letras');
    expect(lines).toContain('Tema dark: (#) Lembrar de mim | [# Entrar #]');
    expect(lines).toContain('Todos os produtos da fábrica dark são do tema dark: true');
    expect(lines).toContain('Histórico até o cancelamento da inscrição: 22, 35');
    expect(lines).toContain('Alertas do alarme: ALERTA: 35 °C passa do limite de 30 °C');
    expect(lines).toContain('Com atacado (15% a partir de 10 itens): 170');
    expect(lines).toContain('Ordem decrescente: 3, 2, 1');
    expect(lines.some((line) => line.includes('Estatísticas de Cache:'))).toBe(true);
    expect(lines.some((line) => line.includes('Métricas de Performance:'))).toBe(true);
    expect(lines.some((line) => line.includes('Chain of Responsibility'))).toBe(true);
    expect(lines.some((line) => line.includes('State Pattern'))).toBe(true);
  });
});

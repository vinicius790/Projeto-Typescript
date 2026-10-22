import { Cloneable } from '../cloneable';
import { PrototypeNotFoundError, PrototypeRegistry } from '../registry';
import type { Log } from './circular-reference.example';

class Shape extends Cloneable {
  constructor(
    public kind: string,
    public color: string,
    public size: { width: number; height: number },
  ) {
    super();
  }

  describe(): string {
    return `${this.kind} ${this.color} de ${this.size.width}x${this.size.height}`;
  }
}

export function runRegistryExample(log: Log = console.log): void {
  const registry = new PrototypeRegistry<Shape>()
    .register('quadrado-azul', new Shape('quadrado', 'azul', { width: 10, height: 10 }))
    .register('faixa-vermelha', new Shape('retângulo', 'vermelho', { width: 40, height: 5 }));

  const first = registry.create('quadrado-azul');
  const second = registry.create('quadrado-azul');
  second.color = 'verde';
  second.size.width = 25;

  log('--- Registro de protótipos ---');
  log(`Chaves registradas: ${registry.keys().join(', ')}`);
  log(`Primeiro clone: ${first.describe()}`);
  log(`Segundo clone, personalizado: ${second.describe()}`);
  log(`Novo clone após a personalização: ${registry.create('quadrado-azul').describe()}`);

  try {
    registry.create('triângulo');
  } catch (error) {
    if (!(error instanceof PrototypeNotFoundError)) {
      throw error;
    }
    log(`Chave desconhecida: ${error.message}`);
  }
}

import { runAbstractFactoryExample } from './abstract-factory/abstract-factory.example';
import { runAdapterExample } from './adapter/adapter.example';
import { runBuilderExample } from './builder/builder.example';
import { runChainOfResponsibilityExample } from './chain-of-responsibility/chain-of-responsibility.example';
import { runDecoratorExample } from './decorator/decorator.example';
import { runFactoryMethodExample } from './factory-method/factory-method.example';
import type { Log } from './log';
import { runObserverExample } from './observer/observer.example';
import { runStateExample } from './state/state.example';
import { runStrategyExample } from './strategy/strategy.example';

export {
  runAbstractFactoryExample,
  runAdapterExample,
  runBuilderExample,
  runChainOfResponsibilityExample,
  runDecoratorExample,
  runFactoryMethodExample,
  runObserverExample,
  runStateExample,
  runStrategyExample,
};

export function runAllPatternExamples(log: Log = console.log): void {
  runBuilderExample(log);
  runFactoryMethodExample(log);
  runAbstractFactoryExample(log);
  runObserverExample(log);
  runStrategyExample(log);
  runAdapterExample(log);
  runDecoratorExample(log);
  runChainOfResponsibilityExample(log);
  runStateExample(log);
}

// Só executa quando o arquivo é chamado diretamente (`npm run examples`);
// importar este módulo não produz nenhum efeito colateral.
if (require.main === module) {
  runAllPatternExamples();
}

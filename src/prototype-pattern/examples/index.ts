import { runCircularReferenceExample } from './circular-reference.example';
import { runRegistryExample } from './registry.example';
import { runShallowVsDeepExample } from './shallow-vs-deep.example';

export { runCircularReferenceExample, runRegistryExample, runShallowVsDeepExample };

export function runAllExamples(log: (message: string) => void = console.log): void {
  runShallowVsDeepExample(log);
  runCircularReferenceExample(log);
  runRegistryExample(log);
}

// Só executa quando o arquivo é chamado diretamente (`npm run examples`);
// importar este módulo não produz nenhum efeito colateral.
if (require.main === module) {
  runAllExamples();
}

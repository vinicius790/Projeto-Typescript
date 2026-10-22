import { PrototypeRegistry } from '../prototype-pattern';
import { PrototypeModel } from './prototype.model';

/**
 * Catálogo de modelos prontos. A API (`POST /prototypes/from-template/:key`) e
 * o seed criam registros clonando um item deste catálogo.
 */
export function createTemplateRegistry(): PrototypeRegistry<PrototypeModel> {
  return new PrototypeRegistry<PrototypeModel>()
    .register(
      'basico',
      new PrototypeModel('Protótipo básico', 0, new Date('2024-01-01T00:00:00.000Z')),
    )
    .register(
      'com-referencia',
      new PrototypeModel(
        'Protótipo com referência circular',
        245,
        new Date('2024-06-15T12:00:00.000Z'),
        'componente padrão',
      ),
    );
}

import _ from 'lodash';

interface IPrototype {
  primitive: number;
  component: Date;
  circularReference: IComponentWithBackReference;
  clone(): this;
}

interface IComponentWithBackReference {
  prototype: IPrototype;
}

export class Prototype implements IPrototype {
  public primitive: number;
  public component: Date;
  public circularReference: ComponentWithBackReference;

  public clone(): this {
    const clone = _.cloneDeep(this);
    clone.component = new Date(this.component.getTime());
    clone.circularReference = new ComponentWithBackReference(clone);
    return clone;
  }
}

export class ComponentWithBackReference implements IComponentWithBackReference {
  public prototype: IPrototype;

  constructor(prototype: IPrototype) {
    this.prototype = prototype;
  }
}

/* Código do cliente */

function clientCode() {
  try {
    const p1 = new Prototype();
    p1.primitive = 245;
    p1.component = new Date();
    p1.circularReference = new ComponentWithBackReference(p1);

    const p2 = p1.clone();

    console.log(p1.primitive === p2.primitive
      ? 'Primitive field values have been carried over to a clone. Yay!'
      : 'Primitive field values have not been copied. Booo!');

    console.log(p1.component === p2.component
      ? 'Simple component has not been cloned. Booo!'
      : 'Simple component has been cloned. Yay!');

    console.log(p1.circularReference === p2.circularReference
      ? 'Component with back reference has not been cloned. Booo!'
      : 'Component with back reference has been cloned. Yay!');

    console.log(p1.circularReference.prototype === p2.circularReference.prototype
      ? 'Component with back reference is linked to original object. Booo!'
      : 'Component with back reference is linked to the clone. Yay!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

clientCode();

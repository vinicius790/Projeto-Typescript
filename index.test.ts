import { Prototype, ComponentWithBackReference } from './index';

describe('Prototype Pattern', () => {
  it('should clone primitive values correctly', () => {
    const p1 = new Prototype();
    p1.primitive = 245;
    p1.component = new Date();
    p1.circularReference = new ComponentWithBackReference(p1);

    const p2 = p1.clone();

    expect(p1.primitive).toBe(p2.primitive);
  });

  it('should clone component correctly', () => {
    const p1 = new Prototype();
    p1.primitive = 245;
    p1.component = new Date();
    p1.circularReference = new ComponentWithBackReference(p1);

    const p2 = p1.clone();

    expect(p1.component).not.toBe(p2.component);
    expect(p1.component.getTime()).toBe(p2.component.getTime());
  });

  it('should clone circular reference correctly', () => {
    const p1 = new Prototype();
    p1.primitive = 245;
    p1.component = new Date();
    p1.circularReference = new ComponentWithBackReference(p1);

    const p2 = p1.clone();

    expect(p1.circularReference).not.toBe(p2.circularReference);
    expect(p1.circularReference.prototype).not.toBe(p2.circularReference.prototype);
  });
});

// Corrigindo a função expect para funcionar corretamente com Jest
function expect(received: any) {
  return {
    toBe(expected: any) {
      if (received !== expected) {
        throw new Error(`Expected ${received} to be ${expected}`);
      }
    },
    not: {
      toBe(expected: any) {
        if (received === expected) {
          throw new Error(`Expected ${received} not to be ${expected}`);
        }
      }
    }
  };
}

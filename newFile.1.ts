import { Prototype, ComponentWithBackReference } from './index';
import { expect } from './index.test';

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

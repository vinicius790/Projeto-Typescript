export class Prototype {
  id: number;
  primitive: number;
  component: Date;
  circularReference?: CircularReference;
}

export class CircularReference {
  id: number;
  prototypeId: number;
}

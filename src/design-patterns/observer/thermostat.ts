import { EventSubject } from './event-subject';
import type { Observer } from './observer';

export interface TemperatureReading {
  readonly celsius: number;
  readonly previous: number | null;
}

/**
 * Publicador: guarda um estado e avisa quem estiver inscrito quando ele muda.
 * Não sabe quem são os observadores nem o que eles fazem com a leitura.
 */
export class Thermostat {
  readonly readings = new EventSubject<TemperatureReading>();
  private current: number | null = null;

  /** Publica a leitura apenas quando a temperatura muda de fato. */
  setTemperature(celsius: number): void {
    if (celsius === this.current) {
      return;
    }
    const previous = this.current;
    this.current = celsius;
    this.readings.notify({ celsius, previous });
  }
}

/** Observador em forma de classe: dispara um alerta ao passar do limite. */
export class OverheatAlarm implements Observer<TemperatureReading> {
  readonly alerts: string[] = [];

  constructor(private readonly limit: number) {}

  update({ celsius }: TemperatureReading): void {
    if (celsius > this.limit) {
      this.alerts.push(`ALERTA: ${celsius} °C passa do limite de ${this.limit} °C`);
    }
  }
}

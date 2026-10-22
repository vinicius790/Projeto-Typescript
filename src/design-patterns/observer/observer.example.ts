import type { Log } from '../log';
import { OverheatAlarm, Thermostat } from './thermostat';

export function runObserverExample(log: Log = console.log): void {
  const thermostat = new Thermostat();
  const alarm = new OverheatAlarm(30);
  const history: number[] = [];

  thermostat.readings.subscribe(alarm);
  const stopHistory = thermostat.readings.subscribe(({ celsius }) => history.push(celsius));

  thermostat.setTemperature(22);
  thermostat.setTemperature(22); // sem mudança: ninguém é avisado
  thermostat.setTemperature(35);
  stopHistory();
  thermostat.setTemperature(18);

  log('--- Observer ---');
  log(`Histórico até o cancelamento da inscrição: ${history.join(', ')}`);
  log(`Alertas do alarme: ${alarm.alerts.join(' / ')}`);
  log(`Observadores ainda inscritos: ${thermostat.readings.size}`);
}

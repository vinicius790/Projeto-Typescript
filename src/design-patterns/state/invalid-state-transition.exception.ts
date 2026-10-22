import { OrderStatusName } from './state.types';

/**
 * Exceção de Domínio disparada ao tentar invocar uma operação ou transição
 * não permitida para o estado atual da Ordem/Serviço.
 */
export class InvalidStateTransitionException extends Error {
  public readonly currentState: OrderStatusName;
  public readonly attemptedAction: string;
  public readonly allowedActions: string[];

  constructor(
    currentState: OrderStatusName,
    attemptedAction: string,
    allowedActions: string[],
    customMessage?: string,
  ) {
    const defaultMsg = `Ação inválida '${attemptedAction}' para o estado atual '${currentState}'. Ações permitidas: [${allowedActions.join(', ')}].`;
    super(customMessage || defaultMsg);
    this.name = 'InvalidStateTransitionException';
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
    this.allowedActions = allowedActions;
    Object.setPrototypeOf(this, InvalidStateTransitionException.prototype);
  }
}

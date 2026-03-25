import { GameState, GameEvent } from './types';
import { processEvent } from './UnoEngine';

export class UnoGame {
  private state: GameState;
  private listeners: ((state: GameState) => void)[] = [];

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  public getState(): GameState {
    return this.state;
  }

  public dispatch(event: GameEvent) {
    this.state = processEvent(this.state, event);
    this.emit();
  }

  public subscribe(listener: (state: GameState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit() {
    this.listeners.forEach(listener => listener(this.state));
  }
}
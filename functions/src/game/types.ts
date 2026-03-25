export type Color = 'Red' | 'Green' | 'Blue' | 'Yellow';
export type Value = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'Skip' | 'Reverse' | 'Draw Two' | 'Wild' | 'Wild Draw Four';

export interface Card {
  id: string;
  color?: Color;
  value: Value;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: 'Easy' | 'Medium' | 'Hard' | 'Cheater';
  hand: Card[];
  isUno: boolean;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  turnIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  drawPile: Card[];
  activeColor: Color | null;
  stackCount: number;
  winners: string[];
}

export type GameEvent =
  | { type: 'CARD_PLAYED'; playerId: string; cardId: string; declaredColor?: Color }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'CALL_UNO'; playerId: string }
  | { type: 'CHALLENGE_WILD'; playerId: string }
  | { type: 'PLAYER_LEFT'; playerId: string };
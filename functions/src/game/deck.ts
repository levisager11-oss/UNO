import { Card, Color, Value } from './types';

export function createDeck(): Card[] {
  const colors: Color[] = ['Red', 'Green', 'Blue', 'Yellow'];
  const values: Value[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw Two'];
  const deck: Card[] = [];

  const genId = () => Math.random().toString(36).substring(2, 10);

  for (const color of colors) {
    for (const value of values) {
      deck.push({ id: genId(), color, value });
      if (value !== '0') {
        deck.push({ id: genId(), color, value });
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push({ id: genId(), value: 'Wild' });
    deck.push({ id: genId(), value: 'Wild Draw Four' });
  }

  return shuffle(deck);
}

export function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}
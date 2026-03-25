import { GameState, GameEvent, Card, Color } from './types';

export function evaluateBotMove(state: GameState, botPlayerId: string): GameEvent | null {
  if (state.status !== 'playing') return null;
  
  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer.id !== botPlayerId) return null;
  
  const topCard = state.discardPile[state.discardPile.length - 1];
  const activeColor = state.activeColor;
  const hand = currentPlayer.hand;

  const validCards = hand.filter(card => {
    if (state.stackCount > 0) {
      if (topCard.value === 'Draw Two' && card.value === 'Draw Two') return true;
      if (topCard.value === 'Wild Draw Four' && card.value === 'Wild Draw Four') return true;
      return false;
    }
    if (card.value === 'Wild' || card.value === 'Wild Draw Four') return true;
    if (card.color === activeColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  });

  if (validCards.length === 0) {
    return { type: 'DRAW_CARD', playerId: botPlayerId };
  }

  // Call UNO if 2 cards before playing (will leave 1 card)
  if (hand.length === 2 && !currentPlayer.isUno) {
    if (currentPlayer.botDifficulty === 'Easy' && Math.random() < 0.5) {
      // 50% chance Easy bot forgets to call UNO
    } else {
      return { type: 'CALL_UNO', playerId: botPlayerId };
    }
  }

  let selectedCard: Card;
  
  switch (currentPlayer.botDifficulty) {
    case 'Easy':
      // Random valid card
      selectedCard = validCards[Math.floor(Math.random() * validCards.length)];
      break;
    case 'Medium': {
      // Prefer playing colored cards, save wilds
      const colorsOnly = validCards.filter(c => c.value !== 'Wild' && c.value !== 'Wild Draw Four');
      if (colorsOnly.length > 0) {
        selectedCard = colorsOnly[Math.floor(Math.random() * colorsOnly.length)];
      } else {
        selectedCard = validCards[0];
      }
      break;
    }
    case 'Hard':
    case 'Cheater': {
      // Prefer action cards (skip/reverse/draw two), then colors, save wilds
      const actions = validCards.filter(c => ['Skip', 'Reverse', 'Draw Two'].includes(c.value));
      const colors = validCards.filter(c => c.color && !['Skip', 'Reverse', 'Draw Two'].includes(c.value));
      if (actions.length > 0) {
        selectedCard = actions[0];
      } else if (colors.length > 0) {
        selectedCard = colors[0];
      } else {
        selectedCard = validCards[0];
      }
      break;
    }
    default:
      selectedCard = validCards[0];
  }

  let declaredColor: Color | undefined = undefined;
  if (selectedCard.value === 'Wild' || selectedCard.value === 'Wild Draw Four') {
    const colorCounts: Record<Color, number> = { Red: 0, Green: 0, Blue: 0, Yellow: 0 };
    hand.forEach(c => { if (c.color) colorCounts[c.color]++; });
    
    let maxColor: Color = 'Red';
    let maxCount = -1;
    for (const [col, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxColor = col as Color;
      }
    }
    declaredColor = maxCount > 0 ? maxColor : ['Red', 'Green', 'Blue', 'Yellow'][Math.floor(Math.random() * 4)] as Color;
  }

  return {
    type: 'CARD_PLAYED',
    playerId: botPlayerId,
    cardId: selectedCard.id,
    declaredColor
  };
}
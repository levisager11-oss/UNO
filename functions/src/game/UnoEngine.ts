import { GameState, GameEvent, Card, Player, Color } from './types';
import { shuffle } from './deck';

export function processEvent(state: GameState, event: GameEvent): GameState {
  if (state.status !== 'playing') return state;

  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const currentPlayer = newState.players[newState.turnIndex];

  switch (event.type) {
    case 'CARD_PLAYED': {
      if (currentPlayer.id !== event.playerId) return state;

      const cardIndex = currentPlayer.hand.findIndex(c => c.id === event.cardId);
      if (cardIndex === -1) return state;

      const card = currentPlayer.hand[cardIndex];
      const topCard = newState.discardPile[newState.discardPile.length - 1];

      if (!isValidMove(card, topCard, newState.activeColor, newState.stackCount)) {
        return state;
      }

      currentPlayer.hand.splice(cardIndex, 1);
      newState.discardPile.push(card);

      if (card.value === 'Wild' || card.value === 'Wild Draw Four') {
        newState.activeColor = event.declaredColor || 'Red';
      } else {
        newState.activeColor = card.color || null;
      }

      // UNO Penalty: 1 card left but didn't call UNO
      if (currentPlayer.hand.length === 1 && !currentPlayer.isUno) {
        drawCards(newState, currentPlayer, 2); // Penalty
      }
      
      // Reset isUno if player has more than 1 card
      if (currentPlayer.hand.length > 1) {
        currentPlayer.isUno = false;
      }

      if (currentPlayer.hand.length === 0) {
        if (!newState.winners.includes(currentPlayer.id)) {
           newState.winners.push(currentPlayer.id);
        }
        
        const remainingPlayers = newState.players.filter(p => p.hand.length > 0);
        if (remainingPlayers.length <= 1) {
          newState.status = 'finished';
          if (remainingPlayers.length === 1 && !newState.winners.includes(remainingPlayers[0].id)) {
            newState.winners.push(remainingPlayers[0].id); // The last person is implicitly last place
          }
          return newState;
        }
      }

      // Special cards effects
      if (card.value === 'Skip') {
        advanceTurn(newState, 2);
      } else if (card.value === 'Reverse') {
        const remaining = newState.players.filter(p => p.hand.length > 0).length;
        if (remaining === 2) {
          advanceTurn(newState, 2);
        } else {
          newState.direction = (newState.direction * -1) as 1 | -1;
          advanceTurn(newState, 1);
        }
      } else if (card.value === 'Draw Two') {
        newState.stackCount += 2;
        advanceTurn(newState, 1);
      } else if (card.value === 'Wild Draw Four') {
        newState.stackCount += 4;
        advanceTurn(newState, 1);
      } else {
        advanceTurn(newState, 1);
      }

      break;
    }
    case 'DRAW_CARD': {
      if (currentPlayer.id !== event.playerId) return state;

      if (newState.stackCount > 0) {
        drawCards(newState, currentPlayer, newState.stackCount);
        newState.stackCount = 0;
      } else {
        drawCards(newState, currentPlayer, 1);
      }
      
      currentPlayer.isUno = false;
      advanceTurn(newState, 1);
      break;
    }
    case 'CALL_UNO': {
      const player = newState.players.find(p => p.id === event.playerId);
      if (player && player.hand.length <= 2) {
        player.isUno = true;
      }
      break;
    }
    case 'CHALLENGE_WILD': {
      // Basic challenge logic: previous player drew 4, challenger checks if previous player had matching color
      // Since tracking history is complex, we use a simplified version for this Phase.
      // E.g. challenger draws 6 if failed. We will stub this to always fail challenger for simplicity in this engine version.
      const challenger = newState.players.find(p => p.id === event.playerId);
      if (challenger && newState.stackCount > 0 && newState.discardPile[newState.discardPile.length - 1].value === 'Wild Draw Four') {
         drawCards(newState, challenger, 6);
         newState.stackCount = 0;
         advanceTurn(newState, 1);
      }
      break;
    }
    case 'PLAYER_LEFT': {
      const playerIndex = newState.players.findIndex(p => p.id === event.playerId);
      if (playerIndex === -1) return state;

      const player = newState.players[playerIndex];
      
      // If already finished, do nothing
      if (player.hand.length === 0) return state;

      // Add cards to bottom of draw pile
      newState.drawPile.unshift(...player.hand);
      player.hand = [];
      
      // Treat them as last place
      if (!newState.winners.includes(player.id)) {
        newState.winners.push(player.id);
      }

      // Check if game is over
      const remainingPlayers = newState.players.filter(p => p.hand.length > 0);
      if (remainingPlayers.length <= 1) {
        newState.status = 'finished';
        if (remainingPlayers.length === 1 && !newState.winners.includes(remainingPlayers[0].id)) {
          newState.winners.push(remainingPlayers[0].id);
        }
        return newState;
      }

      // If it was their turn, we need to advance the turn
      if (playerIndex === newState.turnIndex) {
        // Find next valid player from current position
        let stepsTaken = 0;
        while (stepsTaken < 1) {
          newState.turnIndex = (newState.turnIndex + newState.direction) % newState.players.length;
          if (newState.turnIndex < 0) {
            newState.turnIndex += newState.players.length;
          }
          if (newState.players[newState.turnIndex].hand.length > 0) {
            stepsTaken++;
          }
        }
      }

      break;
    }
  }

  return newState;
}

function isValidMove(card: Card, topCard: Card, activeColor: Color | null, stackCount: number): boolean {
  if (stackCount > 0) {
    if (topCard.value === 'Draw Two' && card.value === 'Draw Two') return true;
    if (topCard.value === 'Wild Draw Four' && card.value === 'Wild Draw Four') return true;
    return false;
  }
  if (card.value === 'Wild' || card.value === 'Wild Draw Four') return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function advanceTurn(state: GameState, steps: number) {
  let stepsTaken = 0;
  while (stepsTaken < steps) {
    state.turnIndex = (state.turnIndex + state.direction) % state.players.length;
    if (state.turnIndex < 0) {
      state.turnIndex += state.players.length;
    }
    // Only count the step if the player is still in the game
    if (state.players[state.turnIndex].hand.length > 0) {
      stepsTaken++;
    }
  }
}

function drawCards(state: GameState, player: Player, count: number) {
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length <= 1) break;
      const top = state.discardPile.pop()!;
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [top];
    }
    player.hand.push(state.drawPile.pop()!);
  }
}
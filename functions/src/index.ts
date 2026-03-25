import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onValueUpdated } from 'firebase-functions/v2/database';
import * as admin from 'firebase-admin';
import { createDeck, shuffle } from './game/deck';
import { processEvent } from './game/UnoEngine';
import { evaluateBotMove } from './game/bots';
import { GameState, Player, GameEvent } from './game/types';

admin.initializeApp();

export const startGame = onCall(async (request) => {
  const { lobbyId } = request.data;
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const lobbyRef = admin.database().ref(`/lobbies/${lobbyId}`);
  const lobbySnapshot = await lobbyRef.get();
  
  if (!lobbySnapshot.exists()) {
    throw new HttpsError('not-found', 'Lobby not found');
  }

  const lobby = lobbySnapshot.val();
  if (lobby.hostId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the host can start the game.');
  }

  const deck = createDeck();
  const players: Player[] = lobby.players.map((p: any) => ({
    ...p,
    hand: [],
    isUno: false,
  }));

  // Deal 7 cards to each player
  for (let i = 0; i < 7; i++) {
    for (const player of players) {
      const card = deck.pop();
      if (card) player.hand.push(card);
    }
  }

  // Initial discard card
  let discardCard = deck.pop()!;
  while (discardCard.value === 'Wild Draw Four') {
    deck.unshift(discardCard);
    shuffle(deck);
    discardCard = deck.pop()!;
  }

  const initialState: GameState = {
    id: lobbyId,
    status: 'playing',
    players,
    turnIndex: 0,
    direction: 1,
    discardPile: [discardCard],
    drawPile: deck,
    activeColor: discardCard.color || 'Red',
    stackCount: 0,
    winners: [],
  };

  // Special handle for initial action cards
  if (discardCard.value === 'Skip') {
    initialState.turnIndex = 1 % players.length;
  } else if (discardCard.value === 'Reverse') {
    if (players.length === 2) {
      initialState.turnIndex = 1 % players.length;
    } else {
      initialState.direction = -1;
      initialState.turnIndex = (players.length - 1) % players.length;
    }
  } else if (discardCard.value === 'Draw Two') {
    initialState.stackCount = 2;
  }

  await admin.database().ref(`/games/${lobbyId}`).set(initialState);
  await lobbyRef.update({ status: 'playing' });

  return { success: true };
});

export const playEvent = onCall(async (request) => {
  const { gameId, event } = request.data as { gameId: string, event: GameEvent };
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const gameRef = admin.database().ref(`/games/${gameId}`);
  const gameSnapshot = await gameRef.get();

  if (!gameSnapshot.exists()) {
    throw new HttpsError('not-found', 'Game not found');
  }

  const state = gameSnapshot.val() as GameState;

  // Verify the user calling matches the player making the move
  if (event.type !== 'PLAYER_LEFT') {
    const actingPlayer = state.players.find(p => p.id === event.playerId);
    if (!actingPlayer) {
      throw new HttpsError('not-found', 'Player not found in game');
    }
    if (!actingPlayer.isBot && actingPlayer.id !== request.auth.uid) {
       // Only allow CALL_UNO on others if the logic supports it, 
       // but here evaluate if it's their turn for card play.
       if (event.type === 'CARD_PLAYED' || event.type === 'DRAW_CARD') {
          const currentPlayer = state.players[state.turnIndex];
          if (currentPlayer.id !== request.auth.uid) {
            throw new HttpsError('permission-denied', 'It is not your turn.');
          }
       } else if (event.type === 'CALL_UNO' && actingPlayer.id !== request.auth.uid) {
          throw new HttpsError('permission-denied', 'You can only call UNO for yourself.');
       }
    }
  }

  const newState = processEvent(state, event);
  await gameRef.set(newState);

  if (newState.status === 'finished') {
    await admin.database().ref(`/lobbies/${gameId}`).update({ status: 'finished' });
    
    // Update stats in Firestore
    const batch = admin.firestore().batch();
    newState.players.forEach((player) => {
      if (!player.isBot) {
        const userRef = admin.firestore().collection('users').doc(player.id);
        const isWinner = newState.winners[0] === player.id;
        batch.set(userRef, {
          gamesPlayed: admin.firestore.FieldValue.increment(1),
          wins: admin.firestore.FieldValue.increment(isWinner ? 1 : 0),
        }, { merge: true });
      }
    });
    await batch.commit();
  }

  return { success: true };
});

export const onGameStateUpdated = onValueUpdated('/games/{gameId}', async (event) => {
  const state = event.data.after.val() as GameState;
  if (state.status !== 'playing') return;

  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer && currentPlayer.isBot) {
    // Artificial delay for bot move
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Re-fetch state to ensure it's still the bot's turn
    const gameId = event.params.gameId;
    const freshSnapshot = await admin.database().ref(`/games/${gameId}`).get();
    const freshState = freshSnapshot.val() as GameState;
    const freshCurrentPlayer = freshState.players[freshState.turnIndex];

    if (freshState.status === 'playing' && freshCurrentPlayer.id === currentPlayer.id && freshCurrentPlayer.isBot) {
      const botMove = evaluateBotMove(freshState, currentPlayer.id);
      if (botMove) {
        const newState = processEvent(freshState, botMove);
        await admin.database().ref(`/games/${gameId}`).set(newState);
      }
    }
  }
});

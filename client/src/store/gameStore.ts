import { create } from 'zustand';
import { ref, onValue, set as setDb, update, push, remove, get as getDb } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuthStore } from './authStore';

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

export interface Lobby {
  id: string;
  name: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Omit<Player, 'hand' | 'isUno'>[];
}

interface GameStore {
  lobbies: Lobby[];
  currentLobby: Lobby | null;
  gameState: GameState | null;
  lastUnoCall: { playerName: string, timestamp: number } | null;
  
  listenToLobbies: () => () => void;
  listenToLobby: (lobbyId: string) => () => void;
  listenToGame: (gameId: string) => () => void;
  
  createLobby: (name: string) => Promise<void>;
  joinLobby: (lobbyId: string) => Promise<void>;
  leaveLobby: (lobbyId: string) => Promise<void>;
  startGame: (lobbyId: string) => Promise<void>;
  addBot: (lobbyId: string, difficulty: string) => Promise<void>;
  kickPlayer: (lobbyId: string, playerId: string) => Promise<void>;
  
  playCard: (gameId: string, cardId: string, declaredColor?: Color) => Promise<void>;
  drawCard: (gameId: string) => Promise<void>;
  callUno: (gameId: string) => Promise<void>;
}

export const useGameStore = create<GameStore>((set) => ({
  lobbies: [],
  currentLobby: null,
  gameState: null,
  lastUnoCall: null,

  listenToLobbies: () => {
    return onValue(ref(db, 'lobbies'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lobbies = Object.entries(data).map(([id, val]: [string, any]) => ({
          ...val,
          id
        }));
        set({ lobbies });
      } else {
        set({ lobbies: [] });
      }
    });
  },

  listenToLobby: (lobbyId: string) => {
    return onValue(ref(db, `lobbies/${lobbyId}`), (snapshot) => {
      const lobby = snapshot.val();
      if (lobby) {
        set({ currentLobby: { ...lobby, id: lobbyId } });
      }
    });
  },

  listenToGame: (gameId: string) => {
    return onValue(ref(db, `games/${gameId}`), (snapshot) => {
      const state = snapshot.val();
      if (state) {
        set({ gameState: state });
      }
    });
  },

  createLobby: async (name: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    
    const lobbyRef = push(ref(db, 'lobbies'));
    await setDb(lobbyRef, {
      name,
      hostId: user.id,
      status: 'waiting',
      players: [{
        id: user.id,
        name: user.username,
        isBot: false
      }]
    });
  },

  joinLobby: async (lobbyId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const lobbyRef = ref(db, `lobbies/${lobbyId}`);
    const snapshot = await getDb(lobbyRef);
    if (!snapshot.exists()) return;

    const lobby = snapshot.val();
    const players = [...(lobby.players || [])];
    if (players.find(p => p.id === user.id)) return;

    players.push({
      id: user.id,
      name: user.username,
      isBot: false
    });

    await update(lobbyRef, { players });
  },

  leaveLobby: async (lobbyId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const lobbyRef = ref(db, `lobbies/${lobbyId}`);
    const snapshot = await getDb(lobbyRef);
    if (!snapshot.exists()) return;

    const lobby = snapshot.val();
    const players = (lobby.players || []).filter((p: any) => p.id !== user.id);

    if (players.length === 0) {
      await remove(lobbyRef);
    } else {
      const updateData: any = { players };
      if (lobby.hostId === user.id) {
        updateData.hostId = players[0].id;
      }
      await update(lobbyRef, updateData);
    }
    set({ currentLobby: null, gameState: null });
  },

  startGame: async (lobbyId: string) => {
    const startGameFn = httpsCallable(functions, 'startGame');
    await startGameFn({ lobbyId });
  },

  addBot: async (lobbyId: string, difficulty: string) => {
    const lobbyRef = ref(db, `lobbies/${lobbyId}`);
    const snapshot = await getDb(lobbyRef);
    if (!snapshot.exists()) return;

    const lobby = snapshot.val();
    const players = [...(lobby.players || [])];
    players.push({
      id: `bot-${Math.random().toString(36).substring(2, 11)}`,
      name: `Bot (${difficulty})`,
      isBot: true,
      botDifficulty: difficulty as 'Easy' | 'Medium' | 'Hard' | 'Cheater'
    });

    await update(lobbyRef, { players });
  },

  kickPlayer: async (lobbyId: string, playerId: string) => {
     const lobbyRef = ref(db, `lobbies/${lobbyId}`);
     const snapshot = await getDb(lobbyRef);
     if (!snapshot.exists()) return;

     const lobby = snapshot.val();
     const players = (lobby.players || []).filter((p: any) => p.id !== playerId);
     await update(lobbyRef, { players });
  },

  playCard: async (gameId: string, cardId: string, declaredColor?: Color) => {
    const playEventFn = httpsCallable(functions, 'playEvent');
    const user = useAuthStore.getState().user;
    if (!user) return;

    await playEventFn({
      gameId,
      event: {
        type: 'CARD_PLAYED',
        playerId: user.id,
        cardId,
        declaredColor
      }
    });
  },

  drawCard: async (gameId: string) => {
    const playEventFn = httpsCallable(functions, 'playEvent');
    const user = useAuthStore.getState().user;
    if (!user) return;

    await playEventFn({
      gameId,
      event: {
        type: 'DRAW_CARD',
        playerId: user.id
      }
    });
  },

  callUno: async (gameId: string) => {
    const playEventFn = httpsCallable(functions, 'playEvent');
    const user = useAuthStore.getState().user;
    if (!user) return;

    await playEventFn({
      gameId,
      event: {
        type: 'CALL_UNO',
        playerId: user.id
      }
    });
  }
}));

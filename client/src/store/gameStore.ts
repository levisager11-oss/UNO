import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

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
  hostId: string;
  players: Omit<Player, 'hand' | 'isUno'>[];
}

interface GameStore {
  socket: Socket | null;
  lobbies: Lobby[];
  currentLobby: Lobby | null;
  gameState: GameState | null;
  lastUnoCall: { playerName: string, timestamp: number } | null;
  
  connect: () => void;
  disconnect: () => void;
  createLobby: (name: string) => void;
  joinLobby: (lobbyId: string, name: string) => void;
  leaveLobby: (lobbyId: string) => void;
  startGame: (lobbyId: string) => void;
  addBot: (lobbyId: string, difficulty: string) => void;
  kickPlayer: (lobbyId: string, playerId: string) => void;
  
  playCard: (gameId: string, cardId: string, declaredColor?: Color) => void;
  drawCard: (gameId: string) => void;
  callUno: (gameId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  lobbies: [],
  currentLobby: null,
  gameState: null,
  lastUnoCall: null,

  connect: () => {
    if (get().socket) return;
    const socket = io(`http://${window.location.hostname}:3001`);

    socket.on('connect', () => {
      socket.emit('get_lobbies');
    });

    socket.on('lobbies_update', (lobbies: Lobby[]) => {
      set({ lobbies });
    });

    socket.on('lobby_joined', (lobby: Lobby) => {
      set({ currentLobby: lobby, gameState: null });
    });

    socket.on('lobby_update', (lobby: Lobby) => {
      set({ currentLobby: lobby });
    });

    socket.on('game_started', (gameState: GameState) => {
      set({ gameState });
    });

    socket.on('game_state_update', (gameState: GameState) => {
      set({ gameState });
    });

    socket.on('uno_called', (data: { playerName: string }) => {
      set({ lastUnoCall: { playerName: data.playerName, timestamp: Date.now() } });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, currentLobby: null, gameState: null });
    }
  },

  createLobby: (name: string) => {
    get().socket?.emit('create_lobby', { name });
  },

  joinLobby: (lobbyId: string, name: string) => {
    get().socket?.emit('join_lobby', { lobbyId, name });
  },

  leaveLobby: (lobbyId: string) => {
    get().socket?.emit('leave_lobby', { lobbyId });
    set({ currentLobby: null, gameState: null });
  },

  startGame: (lobbyId: string) => {
    get().socket?.emit('start_game', { lobbyId });
  },

  addBot: (lobbyId: string, difficulty: string) => {
    get().socket?.emit('add_bot', { lobbyId, difficulty });
  },

  kickPlayer: (lobbyId: string, playerId: string) => {
    get().socket?.emit('kick_player', { lobbyId, playerId });
  },

  playCard: (gameId: string, cardId: string, declaredColor?: Color) => {
    get().socket?.emit('play_card', { gameId, cardId, declaredColor });
  },

  drawCard: (gameId: string) => {
    get().socket?.emit('draw_card', { gameId });
  },

  callUno: (gameId: string) => {
    get().socket?.emit('call_uno', { gameId });
  }
}));

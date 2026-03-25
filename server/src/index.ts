import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createServer } from 'http';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './db';
import { UnoGame } from './game/UnoGame';
import { GameState, Player, Color } from './game/types';
import { evaluateBotMove } from './game/bots';
import { createDeck } from './game/deck';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  }
});

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const info = stmt.run(username, hash);
    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: info.lastInsertRowid, username, games_played: 0, games_won: 0, avatar: null } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username) as any;
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '24h' });
    
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', authenticate, (req: any, res: any) => {
  try {
    const stmt = db.prepare('SELECT id, username, games_played, games_won, avatar FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

interface Lobby {
  id: string;
  hostId: string;
  players: Omit<Player, 'hand' | 'isUno'>[];
}

const lobbies = new Map<string, Lobby>();
const games = new Map<string, UnoGame>();
const botLoops = new Map<string, NodeJS.Timeout>();

function runBotLogic(gameId: string) {
  const game = games.get(gameId);
  if (!game) return;

  const state = game.getState();
  if (state.status !== 'playing') return;

  const currentPlayer = state.players[state.turnIndex];
  if (currentPlayer.isBot) {
    const timeout = setTimeout(() => {
      const g = games.get(gameId);
      if (g) {
        const move = evaluateBotMove(g.getState(), currentPlayer.id);
        if (move) {
          if (move.type === 'CALL_UNO') {
            io.to(gameId).emit('uno_called', { playerName: currentPlayer.name });
          }
          g.dispatch(move);
        }
      }
    }, 1500);
    botLoops.set(gameId, timeout);
  }
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('create_lobby', (data: { name: string }) => {
    const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const lobby: Lobby = {
      id: lobbyId,
      hostId: socket.id,
      players: [{ id: socket.id, name: data.name || 'Player', isBot: false }]
    };
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    
    // Broadcast updated lobbies list to all
    io.emit('lobbies_update', Array.from(lobbies.values()));
    socket.emit('lobby_joined', lobby);
  });

  socket.on('join_lobby', (data: { lobbyId: string, name: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.players.length < 4) {
      if (!lobby.players.find(p => p.id === socket.id)) {
        lobby.players.push({ id: socket.id, name: data.name || 'Player', isBot: false });
      }
      socket.join(data.lobbyId);
      io.to(data.lobbyId).emit('lobby_update', lobby);
      io.emit('lobbies_update', Array.from(lobbies.values()));
      socket.emit('lobby_joined', lobby);
    } else {
      socket.emit('error', 'Lobby not found or full');
    }
  });

  socket.on('leave_lobby', (data: { lobbyId: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby) {
      // If a game is running, notify the engine
      const game = games.get(data.lobbyId);
      if (game && game.getState().status === 'playing') {
        game.dispatch({ type: 'PLAYER_LEFT', playerId: socket.id });
      }

      lobby.players = lobby.players.filter(p => p.id !== socket.id);
      socket.leave(data.lobbyId);
      const humanPlayers = lobby.players.filter(p => !p.isBot);
      if (humanPlayers.length === 0) {
        lobbies.delete(data.lobbyId);
        // Also cleanup games/bots if game was running
        if (botLoops.has(data.lobbyId)) {
          clearTimeout(botLoops.get(data.lobbyId)!);
          botLoops.delete(data.lobbyId);
        }
        games.delete(data.lobbyId);
      } else {
        if (lobby.hostId === socket.id && humanPlayers.length > 0) {
          lobby.hostId = humanPlayers[0].id;
        }
        io.to(data.lobbyId).emit('lobby_update', lobby);
      }
      io.emit('lobbies_update', Array.from(lobbies.values()));
    }
  });

  socket.on('add_bot', (data: { lobbyId: string, difficulty: any }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.hostId === socket.id && lobby.players.length < 4) {
      lobby.players.push({
        id: 'bot_' + Math.random().toString(36).substring(2, 8),
        name: `Bot (${data.difficulty})`,
        isBot: true,
        botDifficulty: data.difficulty
      });
      io.to(data.lobbyId).emit('lobby_update', lobby);
      io.emit('lobbies_update', Array.from(lobbies.values()));
    }
  });

  socket.on('kick_player', (data: { lobbyId: string, playerId: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.hostId === socket.id) {
      lobby.players = lobby.players.filter(p => p.id !== data.playerId);
      io.to(data.lobbyId).emit('lobby_update', lobby);
      io.emit('lobbies_update', Array.from(lobbies.values()));
    }
  });

  socket.on('start_game', (data: { lobbyId: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.hostId === socket.id) {
      const deck = createDeck();
      
      const players: Player[] = lobby.players.map(p => ({
        ...p,
        hand: Array.from({length: 7}, () => deck.pop()!),
        isUno: false
      }));

      let topCardIdx = deck.findIndex(c => c.value !== 'Wild' && c.value !== 'Wild Draw Four' && c.value !== 'Skip' && c.value !== 'Reverse' && c.value !== 'Draw Two');
      if (topCardIdx === -1) topCardIdx = 0;
      const topCard = deck.splice(topCardIdx, 1)[0];

      const initialState: GameState = {
        id: data.lobbyId,
        status: 'playing',
        players,
        turnIndex: 0,
        direction: 1,
        discardPile: [topCard],
        drawPile: deck,
        activeColor: topCard.color || 'Red',
        stackCount: 0,
        winners: []
      };

      const game = new UnoGame(initialState);
      games.set(data.lobbyId, game);

      game.subscribe((state) => {
        io.to(data.lobbyId).emit('game_state_update', state);
        if (botLoops.has(data.lobbyId)) {
          clearTimeout(botLoops.get(data.lobbyId)!);
          botLoops.delete(data.lobbyId);
        }
        runBotLogic(data.lobbyId);
      });

      io.to(data.lobbyId).emit('game_started', initialState);
      runBotLogic(data.lobbyId);
    }
  });

  socket.on('play_card', (data: { gameId: string, cardId: string, declaredColor?: Color }) => {
    const game = games.get(data.gameId);
    if (game) {
      game.dispatch({ type: 'CARD_PLAYED', playerId: socket.id, cardId: data.cardId, declaredColor: data.declaredColor });
    }
  });

  socket.on('draw_card', (data: { gameId: string }) => {
    const game = games.get(data.gameId);
    if (game) {
      game.dispatch({ type: 'DRAW_CARD', playerId: socket.id });
    }
  });

  socket.on('call_uno', (data: { gameId: string }) => {
    const game = games.get(data.gameId);
    if (game) {
      const player = game.getState().players.find(p => p.id === socket.id);
      if (player) {
        io.to(data.gameId).emit('uno_called', { playerName: player.name });
      }
      game.dispatch({ type: 'CALL_UNO', playerId: socket.id });
    }
  });

  socket.on('get_lobbies', () => {
    socket.emit('lobbies_update', Array.from(lobbies.values()));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Cleanup lobbies
    lobbies.forEach((lobby, lobbyId) => {
      if (lobby.players.find(p => p.id === socket.id)) {
        // If a game is running, notify the engine
        const game = games.get(lobbyId);
        if (game && game.getState().status === 'playing') {
          game.dispatch({ type: 'PLAYER_LEFT', playerId: socket.id });
        }

        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        const humanPlayers = lobby.players.filter(p => !p.isBot);
        
        if (humanPlayers.length === 0) {
          lobbies.delete(lobbyId);
           if (botLoops.has(lobbyId)) {
             clearTimeout(botLoops.get(lobbyId)!);
             botLoops.delete(lobbyId);
           }
           games.delete(lobbyId);
        } else {
          if (lobby.hostId === socket.id && humanPlayers.length > 0) {
            lobby.hostId = humanPlayers[0].id;
          }
          io.to(lobbyId).emit('lobby_update', lobby);
        }
        io.emit('lobbies_update', Array.from(lobbies.values()));
      }
    });
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
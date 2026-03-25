import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Users, UserMinus, Bot, Play, ArrowLeft } from 'lucide-react';

export default function LobbyRoom() {
  const navigate = useNavigate();
  const { currentLobby, gameState, leaveLobby, startGame, addBot, kickPlayer, socket } = useGameStore();
  const user = useAuthStore(state => state.user);
  const [botDifficulty, setBotDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Cheater'>('Medium');

  useEffect(() => {
    if (!currentLobby) {
      navigate('/');
    }
  }, [currentLobby, navigate]);

  useEffect(() => {
    if (gameState?.status === 'playing') {
      navigate('/game');
    }
  }, [gameState, navigate]);

  if (!currentLobby || !user) return null;

  const isHost = currentLobby.hostId === socket?.id;
  const isFull = currentLobby.players.length >= 4;

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-red-600 p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Lobby: {currentLobby.id}</h1>    
            <p className="opacity-80 mt-1">{currentLobby.players.length}/4 Players</p>
          </div>
          <button
            onClick={() => leaveLobby(currentLobby.id)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded transition"
          >
            <ArrowLeft size={18} /> Leave
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-8">
            {currentLobby.players.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    {player.isBot ? <Bot size={20} /> : <Users size={20} />}    
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {player.name}
                      {player.isBot && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Bot: {player.botDifficulty}</span>}
                    </p>
                    {player.id === currentLobby.hostId && (
                      <span className="text-xs text-red-600 font-bold uppercase tracking-wider">Host</span>
                    )}
                  </div>
                </div>
                {isHost && player.id !== socket?.id && (
                  <button
                    onClick={() => kickPlayer(currentLobby.id, player.id)}      
                    className="text-gray-400 hover:text-red-500 transition p-2" 
                    title="Kick player"
                  >
                    <UserMinus size={18} />
                  </button>
                )}
              </div>
            ))}

            {Array.from({ length: 4 - currentLobby.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-4 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 text-gray-400">      
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Users size={16} className="opacity-50" />
                </div>
                <p className="italic">Waiting for player...</p>
              </div>
            ))}
          </div>

          {isHost && (
            <div className="flex flex-col gap-4 border-t pt-6">
              <div className="flex gap-4">
                <select
                  value={botDifficulty}
                  onChange={(e) => setBotDifficulty(e.target.value as any)}
                  className="flex-1 py-3 px-4 border-2 border-gray-300 rounded-lg outline-none focus:border-red-600"
                >
                  <option value="Easy">Easy Bot</option>
                  <option value="Medium">Medium Bot</option>
                  <option value="Hard">Hard Bot</option>
                  <option value="Cheater">Cheater Bot</option>
                </select>
                <button
                  disabled={isFull}
                  onClick={() => addBot(currentLobby.id, botDifficulty)}
                  className="flex-1 flex justify-center items-center gap-2 py-3 px-4 border-2 border-red-600 text-red-600 font-bold rounded-lg hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bot size={20} /> Add Bot
                </button>
              </div>
              <button
                disabled={currentLobby.players.length < 2}
                onClick={() => startGame(currentLobby.id)}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} /> Start Game
              </button>
            </div>
          )}
          {!isHost && (
             <div className="text-center text-gray-500 py-4 border-t mt-4">     
               Waiting for host to start the game...
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

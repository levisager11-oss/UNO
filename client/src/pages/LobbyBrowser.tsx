import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { LogOut, Play, Users } from 'lucide-react';

export default function LobbyBrowser() {
  const { user, logout } = useAuthStore();
  const { connect, disconnect, lobbies, createLobby, joinLobby, currentLobby } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    connect();
    return () => {
      // Don't disconnect here because we want to keep connection alive when moving to lobby/game
      // Or maybe we do? Let's just not disconnect on unmount of LobbyBrowser
    };
  }, [connect]);

  useEffect(() => {
    if (currentLobby) {
      navigate('/lobby');
    }
  }, [currentLobby, navigate]);

  const handleCreateLobby = () => {
    if (user) {
      createLobby(user.username);
    }
  };

  const handleJoinLobby = (lobbyId: string) => {
    if (user) {
      joinLobby(lobbyId, user.username);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">UNO Lobby</h1>
            <p className="text-gray-600">Welcome back, {user?.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-gray-500">
              <p>Games Played: {user?.games_played}</p>
              <p>Wins: {user?.games_won}</p>
            </div>
            <button 
              onClick={() => {
                disconnect();
                logout();
              }}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Available Games</h2>
            <button 
              onClick={handleCreateLobby}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            >
              <Play size={18} /> Create Game
            </button>
          </div>
          
          {lobbies.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No games available right now. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {lobbies.map(lobby => (
                <div key={lobby.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-full text-red-600">
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Lobby: {lobby.id}</h3>
                      <p className="text-gray-500 text-sm">{lobby.players.length}/4 Players</p>
                    </div>
                  </div>
                  <button
                    disabled={lobby.players.length >= 4}
                    onClick={() => handleJoinLobby(lobby.id)}
                    className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {lobby.players.length >= 4 ? 'Full' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

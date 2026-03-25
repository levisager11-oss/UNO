import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import LobbyBrowser from './pages/LobbyBrowser';
import LobbyRoom from './pages/LobbyRoom';
import GameRoom from './pages/GameRoom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(state => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const { token, setAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAuth(data.user, token);
        } else {
          logout();
        }
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [token, setAuth, logout]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <LobbyBrowser />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/lobby" 
          element={
            <ProtectedRoute>
              <LobbyRoom />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/game" 
          element={
            <ProtectedRoute>
              <GameRoom />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;

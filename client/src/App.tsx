import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import LobbyBrowser from './pages/LobbyBrowser';
import LobbyRoom from './pages/LobbyRoom';
import GameRoom from './pages/GameRoom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const { init, loading } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

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

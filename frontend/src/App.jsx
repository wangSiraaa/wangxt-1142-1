import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DispatcherPage from './pages/DispatcherPage';
import LoaderPage from './pages/LoaderPage';
import PurserPage from './pages/PurserPage';
import 'antd/dist/reset.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('catering_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('catering_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('catering_user');
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  switch (user.role) {
    case 'dispatcher':
      return <DispatcherPage user={user} onLogout={handleLogout} />;
    case 'loader':
      return <LoaderPage user={user} onLogout={handleLogout} />;
    case 'purser':
      return <PurserPage user={user} onLogout={handleLogout} />;
    default:
      return <LoginPage onLogin={handleLogin} />;
  }
}

export default App;

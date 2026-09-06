import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken, getStoredUser, setStoredUser } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      const currentToken = getToken();
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const u = await api('/api/auth/me');
        setUser(u);
        setStoredUser(u);
      } catch (e) {
        // If expired, clear
        clearToken();
        setUser(null);
        setTokenState(null);
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, []);

  const handleAuthSuccess = (tokenStr, userObj) => {
    setToken(tokenStr);
    setTokenState(tokenStr);
    setUser(userObj);
    setStoredUser(userObj);
  };

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    handleAuthSuccess(data.token, data.user);
    return data;
  };

  const signup = async (email, password, role = 'attendee') => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: { email, password, role },
    });
    handleAuthSuccess(data.token, data.user);
    return data;
  };

  const demoLogin = async (role = 'attendee') => {
    const demoEmail = role === 'organizer' ? 'organizer@surgeshield.io' : 'attendee@surgeshield.io';
    const demoPassword = 'Password123!';
    try {
      return await login(demoEmail, demoPassword);
    } catch {
      // If demo user doesn't exist yet, automatically create it
      return await signup(demoEmail, demoPassword, role);
    }
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
    window.location.href = '/login';
  };

  const isOrganizer = user?.role === 'organizer';
  const isAttendee = user?.role === 'attendee';

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || null,
        isOrganizer,
        isAttendee,
        loading,
        login,
        signup,
        demoLogin,
        logout,
        handleAuthSuccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

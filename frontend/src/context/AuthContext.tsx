import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  company?: string;
  vehicle_type?: string;
  license_plate?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useProtectedRoute(user: User | null, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inAdminGroup = segments[0] === 'admin';
    const inDriverGroup = segments[0] === 'driver';
    const isIndex = segments.length === 0 || segments[0] === undefined;

    if (user) {
      // User is logged in
      if (inAuthGroup || isIndex) {
        // Redirect to appropriate dashboard based on role
        if (user.role === 'admin' || user.role === 'supervisor') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/driver/home');
        }
      }
    }
  }, [user, segments, isLoading]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useProtectedRoute(user, isLoading);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const userData = response.data.user;
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur de connexion');
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await api.post('/auth/register', userData);
      const user = response.data.user;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || "Erreur lors de l'inscription");
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

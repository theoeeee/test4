import axios from 'axios';
import Constants from 'expo-constants';

// Force l'URL du backend à localhost pour le développement local
// Si vous testez sur un appareil physique, changez cette URL par l'IP de votre machine
const BACKEND_URL = __DEV__ 
  ? 'http://localhost:8000' 
  : (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000');

console.log('🔗 Backend URL:', BACKEND_URL);

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

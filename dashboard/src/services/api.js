import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
const FRONTEND_URL = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tradepulse_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('tradepulse_token');
      localStorage.removeItem('tradepulse_user');
      // Token expired or invalid — send user back to login.
      if (typeof window !== 'undefined') {
        window.location.href = `${FRONTEND_URL}/signup`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

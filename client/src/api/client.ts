import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept 401s if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Return structured error message from server
    return Promise.reject(error);
  }
);

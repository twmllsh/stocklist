import axios from 'axios';

const authAxios = axios.create({
  baseURL: '/accounts', // '/api/accounts' -> '/accounts'로 수정
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 인터셉터 설정
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // auth 관련 401 처리
    }
    return Promise.reject(error);
  }
);

export default authAxios;

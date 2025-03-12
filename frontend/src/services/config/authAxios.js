import axios from 'axios';

const authAxios = axios.create({
  baseURL: '/accounts', // 백엔드 URL이 올바른지 확인
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터에 디버깅 로그 추가
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터에 디버깅 로그 추가
authAxios.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // auth 관련 401 처리
    }
    return Promise.reject(error);
  }
);

export default authAxios;

import axios from 'axios';

const stockAxios = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터에서 토큰 추가
stockAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // console.log('Request config:', {
    //   url: config.url,
    //   method: config.method,
    //   headers: config.headers,
    //   data: config.data,
    // });
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터
stockAxios.interceptors.response.use(
  (response) => {
    // console.log('Response:', response);
    return response;
  },
  (error) => {
    console.error('Response error:', error.response);
    return Promise.reject(error);
  }
);

export default stockAxios;

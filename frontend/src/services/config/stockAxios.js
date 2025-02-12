import axios from 'axios';

const stockAxios = axios.create({
  baseURL: '/api/', // 끝에 슬래시 추가
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 수정
stockAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`; // 형식 수정
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 수정
stockAxios.interceptors.response.use(
  (response) => response.data, // axios가 자동으로 response.data 반환
  async (error) => {
    if (error.response?.status === 401) {
      // 토큰 갱신 시도
      const refresh_token = localStorage.getItem('refresh_token');
      if (refresh_token) {
        try {
          const authAxios = (await import('./authAxios')).default;
          const response = await authAxios.post('/token/refresh/', {
            refresh_token,
          });
          if (response.access) {
            localStorage.setItem('access_token', response.access);
            error.config.headers['Authorization'] = `Bearer ${response.access}`;
            return axios(error.config); // 원래 요청 재시도
          }
        } catch (refreshError) {
          // 토큰 갱신 실패 시 로그아웃 처리
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default stockAxios;

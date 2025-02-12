import authAxios from './config/authAxios';

export const authService = {
  // 회원가입
  register: async (userData) => {
    return await authAxios.post('/register/', userData); // /accounts/register로 요청
  },

  // 로그인
  login: async (credentials) => {
    try {
      console.log('Login attempt with:', credentials);
      const response = await authAxios.post('/login/', credentials); // '/accounts' 제거
      // console.log('Login response:', response);
      return response;
    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },

  // 로그아웃
  logout: async (refresh_token) => {
    return await authAxios.post('/logout/', {
      refresh: refresh_token, // 'refresh_token' -> 'refresh'로 키 이름 변경
    });
  },

  // 회원등급 승격
  upgradeMembership: async () => {
    return await authAxios.post('/upgrade/');
  },

  // 토큰 갱신
  refreshToken: async (refresh_token) => {
    return await authAxios.post('/token/refresh/', { refresh_token });
  },
};

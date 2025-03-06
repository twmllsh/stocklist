import authAxios from './config/authAxios';

export const authService = {
  // 회원가입
  register: async (userData) => {
    try {
      const response = await authAxios.post('/register/', userData);
      return response;
    } catch (error) {
      // 에러 응답을 그대로 throw하여 컴포넌트에서 처리할 수 있게 함
      throw error;
    }
  },

  // 로그인
  login: async (credentials) => {
    try {
      // 디버깅용 로그 추가
      // console.log('Login request URL:', authAxios.defaults.baseURL + '/login/');
      // console.log('Login request headers:', authAxios.defaults.headers);
      // console.log('Login request data:', credentials);

      const response = await authAxios.post('/login/', credentials);
      // console.log('Login response:', response);
      return response;
    } catch (error) {
      // 에러 상세 정보 출력
      console.error('Login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
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

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

  // 로그아웃 함수 수정
  logout: async () => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');

      if (refresh_token) {
        try {
          await authAxios.post('/logout/', {
            refresh: refresh_token, // 키 이름을 'refresh_token'에서 'refresh'로 변경
          });
        } catch (error) {
          console.error('Logout API call failed:', error);
          // API 호출 실패는 무시하고 계속 진행
        }
      }

      // 항상 로컬 스토리지 클리어
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      return true;
    } catch (error) {
      console.error('Logout process error:', error);
      // 에러가 발생하더라도 로컬 스토리지는 클리어
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw error;
    }
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

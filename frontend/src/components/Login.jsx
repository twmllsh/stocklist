const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const response = await authService.login({ username, password });
    console.log('Raw login response:', response);

    if (!response?.user?.username) {
      throw new Error('Invalid response format');
    }

    // Redux store 업데이트 구조 수정
    const userData = {
      token: response.access, // access를 token으로 매핑
      user: response.user, // user 객체 그대로 전달
    };

    console.log('Dispatching to Redux:', userData);
    dispatch(setCredentials(userData));

    // 토큰 저장
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);

    navigate('/');
  } catch (error) {
    console.error('Login failed:', error);
    setError('로그인에 실패했습니다.');
  }
};

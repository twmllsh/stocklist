import { useDispatch, useSelector } from 'react-redux';
import { logout, selectCurrentUser } from '../store/slices/authSlice';
import { authService } from '../services/authService';
import { Container, Navbar, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      if (!refresh_token) {
        throw new Error('No refresh token found');
      }

      console.log('Sending refresh token:', refresh_token); // 디버깅용
      await authService.logout(refresh_token);
    } catch (error) {
      console.error('Logout failed:', error.response?.data || error.message); // 에러 상세 정보 출력
    } finally {
      // 에러 발생 여부와 관계없이 로컬 상태 초기화
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      dispatch(logout());
      navigate('/login');
    }
  };

  const handleUpgrade = async () => {
    try {
      const response = await authService.upgradeMembership();
      if (response.detail) {
        alert(response.detail);
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" className="mb-4">
        <Container>
          <Navbar.Brand>대시보드</Navbar.Brand>
          <div>
            {user?.membership === 'ASSOCIATE' && (
              <Button
                variant="success"
                onClick={handleUpgrade}
                className="me-2"
              >
                정회원 신청
              </Button>
            )}
            <Button variant="outline-light" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </Container>
      </Navbar>
      <Container>
        <h4>
          환영합니다
          {user
            ? `, ${user.username}님 (${
                user.membership === 'REGULAR' ? '정회원' : '준회원'
              })`
            : ''}
          !
        </h4>
      </Container>
    </>
  );
}

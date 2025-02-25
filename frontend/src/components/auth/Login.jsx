import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Alert,
  Card,
} from 'react-bootstrap';
import { fetchFavorites } from '../../store/slices/favoriteSlice';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.login({ username, password });
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      dispatch(
        setCredentials({
          user: {
            username: response.username,
            membership: response.membership,
          },
          access: response.access,
          refresh: response.refresh,
        })
      );

      // 로그인 성공 후 즐겨찾기 데이터 가져오기
      await dispatch(fetchFavorites());

      navigate('/list');
    } catch (error) {
      setError('로그인에 실패했습니다.');
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      fluid
      className="vh-100 d-flex align-items-center justify-content-center"
      style={{
        background: 'linear-gradient(135deg, #20bf55 0%, #01baef 100%)',
      }}
    >
      <Card
        className="shadow-lg border-0"
        style={{ maxWidth: '400px', width: '90%' }}
      >
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <h5
              className="display-4 fw-bold mb-0"
              style={{
                color: '#2c3e50',
                letterSpacing: '-1px', // 글자 간격 조정
                whiteSpace: 'nowrap', // 한 줄로 표시
              }}
            >
              StockList
            </h5>
            <p className="text-muted mt-2">시장을 읽는 새로운 방법</p>
          </div>

          {error && (
            <Alert variant="danger" className="py-2 mb-4">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디"
                className="py-2"
                style={{
                  borderRadius: '10px',
                  border: '2px solid #eee',
                  fontSize: '1rem',
                }}
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="py-2"
                style={{
                  borderRadius: '10px',
                  border: '2px solid #eee',
                  fontSize: '1rem',
                }}
                required
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              className="w-100 py-2 mb-3"
              disabled={loading}
              style={{
                borderRadius: '10px',
                background: 'linear-gradient(to right, #20bf55, #01baef)',
                border: 'none',
                fontSize: '1.1rem',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div className="text-center">
              <span className="text-muted">계정이 없으신가요?</span>{' '}
              <Link
                to="/register"
                className="text-decoration-none fw-bold"
                style={{ color: '#20bf55' }}
              >
                회원가입
              </Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

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
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', // 더 부드러운 그라데이션
        backdropFilter: 'blur(10px)',
      }}
    >
      <Card
        className="shadow-lg border-0"
        style={{
          maxWidth: '380px',
          width: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '16px',
        }}
      >
        <Card.Body className="px-4 py-5">
          <div className="text-center mb-4">
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: '#2c3e50',
                letterSpacing: '-0.5px',
                marginBottom: '8px',
              }}
            >
              StockList
            </h1>
            <p className="text-muted" style={{ fontSize: '0.95rem' }}>
              주식 정보를 한 눈에! 📈 ver0.5
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              className="py-2 mb-4 text-center"
              style={{ borderRadius: '8px', fontSize: '0.9rem' }}
            >
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <Form.Group>
              <Form.Control
                type="text"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  padding: '0.8rem 1rem',
                  fontSize: '0.95rem',
                  border: '1.5px solid #e1e1e1',
                  borderRadius: '10px',
                  backgroundColor: '#f8f9fa',
                  transition: 'all 0.2s ease',
                }}
                required
              />
            </Form.Group>

            <Form.Group>
              <Form.Control
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: '0.8rem 1rem',
                  fontSize: '0.95rem',
                  border: '1.5px solid #e1e1e1',
                  borderRadius: '10px',
                  backgroundColor: '#f8f9fa',
                  transition: 'all 0.2s ease',
                }}
                required
              />
            </Form.Group>

            <Button
              type="submit"
              className="w-100 mt-2"
              disabled={loading}
              style={{
                padding: '0.8rem',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '10px',
                backgroundColor: '#4B6BFB',
                border: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(75, 107, 251, 0.2)',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>

            <div className="text-center mt-4">
              <span style={{ color: '#6c757d', fontSize: '0.95rem' }}>
                계정이 없으신가요?{' '}
                <Link
                  to="/register"
                  style={{
                    color: '#4B6BFB',
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  회원가입
                </Link>
              </span>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

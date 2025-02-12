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
      className="vh-100 d-flex align-items-center"
      style={{ background: '#f8f9fa' }}
    >
      <Container
        style={{ maxWidth: '460px', minWidth: '320px', width: '100%' }}
      >
        <div className="text-center mb-5">
          <h1
            className="fw-bold"
            style={{ color: '#2c3e50', fontSize: '2.5rem' }}
          >
            Stock List
          </h1>
          <p className="text-muted">......</p>
        </div>
        {error && (
          <Alert variant="danger" className="py-2 mb-4 text-center rounded-3">
            {error}
          </Alert>
        )}
        <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          <Form.Control
            type="text"
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="form-control-lg border-0 shadow-sm py-3"
            style={{
              background: '#fff',
              fontSize: '1rem',
              minHeight: '3.2rem',
            }}
          />
          <Form.Control
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-control-lg border-0 shadow-sm py-3"
            style={{
              background: '#fff',
              fontSize: '1rem',
              minHeight: '3.2rem',
            }}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            className="py-3 mt-3 rounded-3 shadow-sm"
            style={{
              background: '#3498db',
              border: 'none',
              fontSize: '1.1rem',
              minHeight: '3.5rem',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>
          <div className="text-center mt-4">
            <span className="text-muted">계정이 없으신가요?</span>{' '}
            <Link
              to="/register"
              className="text-decoration-none fw-bold"
              style={{ color: '#3498db' }}
            >
              회원가입
            </Link>
          </div>
        </Form>
      </Container>
    </Container>
  );
}

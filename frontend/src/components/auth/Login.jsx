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
    <Container fluid className="auth-container bg-light">
      <Row className="justify-content-center align-items-center min-vh-100">
        <Col xs={12} sm={8} md={6} lg={4} className="my-3">
          <Card className="shadow-lg" style={{ maxHeight: '600px' }}>
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">로그인</h2>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form
                onSubmit={handleSubmit}
                className="d-flex flex-column gap-3"
              >
                <Form.Group>
                  <Form.Label>아이디</Form.Label>
                  <Form.Control
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>비밀번호</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                <Button variant="primary" type="submit" className="mt-2">
                  로그인
                </Button>
                <div className="text-center mt-2">
                  계정이 없으신가요? <Link to="/register">회원가입</Link>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

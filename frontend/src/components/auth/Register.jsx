import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { registerSuccess } from '../../store/slices/authSlice';
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

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.password2) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const data = await authService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if (!data.detail) {
        // 회원가입 성공
        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        navigate('/login');
      } else {
        setError(data.detail);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('서버 연결에 실패했습니다.');
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
            회원가입
          </h1>
          <p className="text-muted">......</p>
        </div>
        {error && (
          <Alert variant="danger" className="py-2 mb-4 text-center rounded-3">
            {error}
          </Alert>
        )}
        <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
          {['username', 'email', 'password', 'password2'].map((field) => (
            <Form.Control
              key={field}
              type={field.includes('password') ? 'password' : 'text'}
              placeholder={
                field === 'username'
                  ? '아이디'
                  : field === 'email'
                  ? '이메일'
                  : field === 'password'
                  ? '비밀번호'
                  : '비밀번호 확인'
              }
              value={formData[field]}
              onChange={(e) =>
                setFormData({ ...formData, [field]: e.target.value })
              }
              required
              className="form-control-lg border-0 shadow-sm py-3"
              style={{
                background: '#fff',
                fontSize: '1rem',
                minHeight: '3.2rem',
              }}
            />
          ))}
          <Button
            variant="primary"
            type="submit"
            className="py-3 mt-3 rounded-3 shadow-sm"
            style={{
              background: '#3498db',
              border: 'none',
              fontSize: '1.1rem',
              minHeight: '3.5rem',
            }}
          >
            회원가입
          </Button>
          <div className="text-center mt-4">
            <span className="text-muted">이미 계정이 있으신가요?</span>{' '}
            <Link
              to="/login"
              className="text-decoration-none fw-bold"
              style={{ color: '#3498db' }}
            >
              로그인
            </Link>
          </div>
        </Form>
      </Container>
    </Container>
  );
}

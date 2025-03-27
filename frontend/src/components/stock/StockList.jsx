import { useDispatch, useSelector } from 'react-redux';
import { logout, selectCurrentUser } from '../../store/slices/authSlice';
import { Container, Navbar, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Filter from './Filter';
import FilteredList from './FilteredList';
import { authService } from '../../services/authService'; // 누락된 import 추가
import { useState } from 'react';

export default function StockList() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await authService.logout();
      dispatch(logout());
      navigate('/login');
    } catch (error) {
      console.error('Logout process failed:', error);
      // 에러가 발생하더라도 로컬 상태 초기화 및 리다이렉트
      dispatch(logout());
      navigate('/login');
    }
  };

  const handleFilterToggle = (isOpen) => {
    setIsFilterOpen(isOpen);
  };

  const getMembershipLabel = (membership) => {
    switch (membership) {
      case 'SPECIAL':
        return '특별회원';
      case 'REGULAR':
        return '정회원';
      case 'ASSOCIATE':
        return '준회원';
      default:
        return membership;
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar bg="light" variant="light" className="border-bottom" fixed="top">
        <Container fluid>
          <Navbar.Brand>StockList v0.6</Navbar.Brand>
          <div className="d-flex align-items-center">
            <span className="text-dark me-3">
              {user?.username}님 ({getMembershipLabel(user?.membership)})
            </span>
            <Button variant="danger" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </Container>
      </Navbar>

      <div style={{ marginTop: '56px' }}>
        <Filter onToggle={handleFilterToggle} />
        <div
          style={{
            position: 'sticky',
            top: '110px', // 네비게이션 바 높이 + 여유 공간
            transition: 'all 0.3s ease-out',
            backgroundColor: 'white',
            zIndex: 1000,
          }}
        >
          <FilteredList />
        </div>
      </div>
    </div>
  );
}

import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/slices/authSlice';

const PrivateRoute = ({ children }) => {
  const user = useSelector(selectCurrentUser);
  const token = localStorage.getItem('access_token');

  if (!user || !token) {
    // 사용자가 로그인하지 않은 경우 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  // 로그인한 경우 자식 컴포넌트 렌더링
  return children;
};

export default PrivateRoute;

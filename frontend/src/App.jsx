import { useState, useEffect, lazy, Suspense } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import Dashboard from './components/Dashboard';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';
import { selectIsAuthenticated } from './store/slices/authSlice';
import { fetchFavorites } from './store/slices/favoriteSlice';

// 동적 임포트로 변경
const StockList = lazy(() => import('./components/stock/StockList'));
const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));

// future flags 설정
const router = {
  future: {
    v7_startTransition: true,
  },
};

function PrivateRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (user) {
      dispatch(fetchFavorites());
    }
  }, [dispatch, user]);

  useEffect(() => {
    let startY;

    const handleTouchStart = (e) => {
      startY = e.touches[0].pageY;
    };

    const handleTouchMove = (e) => {
      const y = e.touches[0].pageY;
      const dy = y - startY;

      // 위로 스크롤할 때는 정상 동작
      if (dy < 0) return;

      // 페이지가 맨 위에 있고, 아래로 당기는 경우에만 preventDefault
      if (window.scrollY === 0 && dy > 0) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Router future={router.future}>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/list"
                element={
                  <PrivateRoute>
                    <StockList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Suspense>
        </Router>
      </PersistGate>
    </Provider>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { Alert, Spinner, Card, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/authSlice';

const StockAI = ({ stockCode }) => {
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waitMessage, setWaitMessage] = useState('AI에게 분석 요청중...');

  useEffect(() => {
    let isMounted = true;
    const messageUpdateInterval = setInterval(() => {
      if (isMounted && loading) {
        setWaitMessage((prev) => {
          const messages = [
            'AI에게 분석 요청중...',
            '분석이 진행중입니다. 잠시만 기다려주세요...',
            'AI가 데이터를 분석하고 있습니다...',
            '복잡한 분석이 필요한 경우 시간이 좀 걸릴 수 있습니다...',
          ];
          const currentIndex = messages.indexOf(prev);
          return messages[(currentIndex + 1) % messages.length];
        });
      }
    }, 3000);

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await stockService.getOpinionForStock(stockCode);

        if (isMounted) {
          setData(response[0]);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          // 에러 발생 시에도 로딩 상태 유지, 대기 메시지만 변경
          setWaitMessage(
            '분석에 시간이 걸리고 있습니다. 잠시만 더 기다려주세요...'
          );
          // 실제 오류인 경우에만 에러 상태 설정
          if (err.response?.status === 404 || err.response?.status === 500) {
            setError('AI 분석 데이터를 불러오는데 실패했습니다.');
            setLoading(false);
          }
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      clearInterval(messageUpdateInterval);
    };
  }, [stockCode]);

  // 특별회원 체크는 상단으로 이동
  if (user?.membership !== 'SPECIAL') {
    return (
      <Alert variant="warning">이 기능은 특별회원 전용 서비스입니다.</Alert>
    );
  }

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-5">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <div className="text-primary">{waitMessage}</div>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data) {
    return <Alert variant="info">AI 분석 데이터가 없습니다.</Alert>;
  }

  const getOpinionColor = (opinion) => {
    switch (opinion) {
      case '매수':
        return 'danger';
      case '매도':
        return 'primary';
      case '보류':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 className="mb-0">AI 투자 의견</h5>
            <small className="text-muted">
              분석일시: {new Date(data.created_at).toLocaleString()}
            </small>
          </div>
          <Badge
            bg={getOpinionColor(data.opinion)}
            style={{ fontSize: '1rem' }}
          >
            {data.opinion}
          </Badge>
        </div>

        <div className="border-start border-4 border-primary ps-3 py-2">
          <p className="mb-0" style={{ lineHeight: '1.8' }}>
            {data.reason}
          </p>
        </div>

        <div className="mt-3 text-end">
          <small className="text-muted">
            분석엔진: {data.ai_method.toUpperCase()}
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StockAI;

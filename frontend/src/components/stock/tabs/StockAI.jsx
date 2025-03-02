import React, { useState, useEffect } from 'react';
import { Alert, Spinner, Card, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/authSlice';

const StockAI = ({ stockCode }) => {
  const user = useSelector(selectUser);

  // 특별회원이 아닌 경우 접근 차단
  if (user?.membership !== 'SPECIAL') {
    return (
      <Alert variant="warning">이 기능은 특별회원 전용 서비스입니다.</Alert>
    );
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timeoutId;
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 5초 타임아웃 설정
        timeoutId = setTimeout(() => {
          controller.abort();
          setError('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          setLoading(false);
        }, 5000);

        const response = await Promise.race([
          stockService.getOpinionForStock(stockCode, {
            signal: controller.signal,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 5000)
          ),
        ]);

        clearTimeout(timeoutId);
        setData(response[0]);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' || err.message === 'TIMEOUT') {
          setError('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError('AI 분석 데이터를 불러오는데 실패했습니다.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [stockCode]);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-5">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <div className="text-primary">AI에게 분석 요청중...</div>
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

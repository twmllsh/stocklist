import React, { useState, useEffect } from 'react';
import { Alert, Spinner, Card, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/authSlice';

const StockAI = ({ stockCode, anal = false }) => {
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await stockService.getOpinionForStock(stockCode, {
          anal,
        });
        if (response && response.length > 0) {
          setData(response);
        } else {
          setError('아직 AI 분석 데이터가 없습니다. ');
        }
      } catch (err) {
        setError('AI 분석 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (stockCode) {
      fetchData();
    }
  }, [stockCode, anal]);

  // 회원 등급 체크 수정
  if (user?.membership === 'ASSOCIATE') {
    return (
      <Alert variant="warning">
        이 기능은 정회원 이상만 이용할 수 있습니다.
      </Alert>
    );
  }

  // 특별회원 체크 제거 (정회원도 볼 수 있음)

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

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div>
      {data &&
        data.map((opinion, index) => (
          <Card key={index} className="border-0 shadow-sm mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h5 className="mb-0">AI 투자 의견</h5>
                  <small className="text-muted">
                    분석일시: {new Date(opinion.created_at).toLocaleString()}
                  </small>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <Badge bg={getOpinionColor(opinion.opinion)}>
                    {opinion.opinion}
                  </Badge>
                  {opinion.close && (
                    <small className="text-muted">
                      분석당시 주가: {formatNumber(opinion.close)}원
                    </small>
                  )}
                </div>
              </div>
              <div className="border-start border-4 border-primary ps-3 py-2">
                <p className="mb-0" style={{ lineHeight: '1.8' }}>
                  {opinion.reason}
                </p>
              </div>
              <div className="mt-3 text-end">
                <small className="text-muted">
                  분석엔진: {opinion.ai_method.toUpperCase()}
                </small>
              </div>
            </Card.Body>
          </Card>
        ))}
    </div>
  );
};

export default StockAI;

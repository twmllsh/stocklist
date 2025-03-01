import React, { useState, useEffect } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockAI = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await stockService.getOpinionForStock(stockCode);
        setData(response);
      } catch (err) {
        setError('AI 분석 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <Alert variant="info">AI 분석 데이터가 없습니다.</Alert>;

  return (
    <div className="p-4">
      <div className="mb-4">
        <h4 className="mb-3">
          AI 투자 의견: <span className="text-primary">{data.opinion}</span>
        </h4>
        <div className="border-start border-4 border-primary ps-3">
          <p className="mb-0" style={{ lineHeight: '1.6' }}>
            {data.reason}
          </p>
        </div>
      </div>
      <div className="text-end text-muted">
        <small>분석엔진: {data.ai_method}</small>
      </div>
    </div>
  );
};

export default StockAI;

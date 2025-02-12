import React, { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockBroker = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      console.log('===== 거래원 데이터 요청 시작 =====');
      if (!stockCode) return;

      try {
        setLoading(true);
        const response = await stockService.getStockBroker(stockCode);
        console.log('거래원 데이터:', response);
        setData(response);
      } catch (err) {
        console.error('거래원 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data) return <div>거래원 데이터가 없습니다.</div>;

  return <div>거래원 데이터 준비중...</div>;
};

export default StockBroker;

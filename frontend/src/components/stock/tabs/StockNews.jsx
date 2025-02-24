import React, { useState, useEffect } from 'react';
import { Spinner, ListGroup } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockNews = ({ stockCode }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!stockCode) return;

      try {
        setLoading(true);
        const response = await stockService.getStockNews(stockCode);
        // console.log('뉴스 데이터:', response);
        setData(response || []); // 빈 배열을 기본값으로 설정
      } catch (err) {
        // console.error('뉴스 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
        setData([]); // 에러 시 빈 배열로 설정
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || data.length === 0) return <div>뉴스 데이터가 없습니다.</div>;

  return (
    <ListGroup variant="flush">
      {data.map((item) => (
        <ListGroup.Item key={item.id}>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
          >
            {item.title}
          </a>
          <div className="text-muted small">
            {new Date(item.createdAt).toLocaleDateString()}
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default StockNews;

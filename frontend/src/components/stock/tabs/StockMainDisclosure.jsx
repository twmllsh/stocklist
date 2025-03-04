import React, { useState, useEffect } from 'react';
import { Alert, ListGroup, Spinner, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockMainDisclosure = ({ stockCode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(
          '주요공시 데이터 요청 URL:',
          `/dartinfo/?ticker=${stockCode}`
        );
        const response = await stockService.getStockMainDisclosure(stockCode);
        console.log('주요공시 응답 데이터:', response);
        console.log('응답 데이터 타입:', typeof response);
        console.log('응답이 배열인가?:', Array.isArray(response));
        setData(response);
      } catch (err) {
        console.error('주요공시 데이터 요청 실패:', err);
        console.error('에러 상세:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setError('주요공시 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!data || data.length === 0) {
    return <Alert variant="info">주요공시 데이터가 없습니다.</Alert>;
  }

  const getBadgeVariant = (category) => {
    switch (category) {
      case '계약':
        return 'success';
      case '3자배정유증':
        return 'primary';
      case '전환사채':
        return 'warning';
      case '무상증자':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ListGroup variant="flush">
      {data.map((item, index) => (
        <ListGroup.Item key={index} className="py-3">
          <div className="d-flex justify-content-between align-items-start mb-1">
            <div>
              <Badge bg={getBadgeVariant(item.카테고리)} className="me-2">
                {item.카테고리}
              </Badge>
              <small className="text-muted">{formatDate(item.날짜)}</small>
            </div>
          </div>
          <p className="mb-0 mt-2">{item.대략적인_내용}</p>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default StockMainDisclosure;

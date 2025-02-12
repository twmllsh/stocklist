import React, { useState, useEffect } from 'react';
import { ListGroup, Spinner, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockNews = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNewsUrl = (id) => {
    return `https://news.stockplus.com/m?news_id=${id}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!stockCode) return;

      try {
        setLoading(true);
        setError(null);
        const response = await stockService.getStockNews(stockCode);
        console.log('뉴스 데이터:', response);
        setData(response);
      } catch (err) {
        console.error('뉴스 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
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
      {data &&
        data.map((news) => (
          <ListGroup.Item key={news.id} className="py-3">
            <a
              href={getNewsUrl(news.no)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
            >
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-start">
                  <h6 className="mb-0 text-dark">{news.title}</h6>
                  <small className="text-muted ms-2">
                    {formatDate(news.createdAt)}
                  </small>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex gap-1">
                    {news.tickers.map((ticker, idx) => (
                      <Badge
                        key={idx}
                        bg="light"
                        text="dark"
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          border: '1px solid #dee2e6',
                        }}
                      >
                        {ticker}
                      </Badge>
                    ))}
                  </div>
                  <small className="text-muted">{news.writerName}</small>
                </div>
              </div>
            </a>
          </ListGroup.Item>
        ))}
    </ListGroup>
  );
};

export default StockNews;

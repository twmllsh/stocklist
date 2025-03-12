import React, { useState, useEffect } from 'react';
import { Alert, Card, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockNews = ({ stockCode }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await stockService.getStockNews(stockCode);
        // console.log('뉴스 데이터 응답:', {
        //   전체데이터: data,
        //   데이터타입: typeof data,
        //   배열길이: data?.length,
        //   첫번째항목: data?.[0],
        // });

        // if (data?.[0]) {
        //   // console.log('첫 번째 뉴스 항목 상세:', {
        //   //   키목록: Object.keys(data[0]),
        //   //   값목록: Object.values(data[0]),
        //   // });
        // }

        setNews(data);
      } catch (err) {
        console.error('뉴스 데이터 요청 에러:', err);
        setError('뉴스를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (stockCode) {
      // console.log('뉴스 데이터 요청 시작:', stockCode);
      fetchNews();
    }
  }, [stockCode]);

  if (loading) return <div>로딩중...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!news?.length) return <Alert variant="info">뉴스가 없습니다.</Alert>;

  return (
    <div>
      {news.map((item, index) => {
        const newsUrl = `https://news.stockplus.com/m?news_id=${item.no}`;
        const newsDate = new Date(item.createdAt);

        return (
          <Card
            key={`${item.no}-${item.createdAt}-${index}`}
            className="mb-2 shadow-sm"
            style={{
              fontSize: '0.875rem', // 14px
            }}
          >
            <Card.Body className="py-2 px-3">
              {' '}
              {/* 패딩 축소 */}
              <Card.Title
                style={{
                  fontSize: '0.9375rem', // 15px
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                }}
              >
                <a
                  href={newsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  {item.title}
                </a>
              </Card.Title>
              <div
                className="text-muted d-flex justify-content-between align-items-center"
                style={{ fontSize: '0.75rem' }}
              >
                {' '}
                {/* 12px */}
                <span>
                  {item.writerName} | {newsDate.toLocaleString()}
                </span>
                <div>
                  {Object.entries(item.ticker_names).map(([code, name]) => (
                    <Badge
                      key={code}
                      bg="secondary"
                      className="me-1"
                      title={code}
                      style={{ fontSize: '0.6875rem' }} // 11px
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
};

export default StockNews;

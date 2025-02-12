import React, { useState, useEffect } from 'react';
import { ListGroup, Spinner, Badge } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockIssue = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      console.log('===== 이슈 데이터 요청 시작 =====');
      console.log('종목코드:', stockCode);

      if (!stockCode) {
        console.log('종목코드가 없어서 요청 취소');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await stockService.getStockIssue(stockCode);
        console.log('이슈 API 전체 응답:', response);

        // response가 직접 데이터 배열인 경우 처리
        const issueData = Array.isArray(response)
          ? response
          : Array.isArray(response.data)
          ? response.data
          : [];

        console.log('처리된 이슈 데이터:', issueData);
        setData(issueData);
      } catch (err) {
        console.error('이슈 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date
      .toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\. /g, '.');
  };

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="text-center p-3">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // 에러 상태 표시
  if (error) {
    return <div className="text-danger p-3">{error}</div>;
  }

  // 데이터 없음 상태 표시
  if (!data || data.length === 0) {
    return <div className="text-muted p-3">관련 이슈가 없습니다.</div>;
  }

  // 데이터 렌더링
  return (
    <ListGroup variant="flush">
      {data.map((issue) => (
        <ListGroup.Item key={issue.id} className="py-3">
          <a
            href={issue.hl_cont_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
          >
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between align-items-start">
                <h6 className="mb-0 text-dark">{issue.hl_str}</h6>
                <small className="text-muted ms-2">
                  {formatDate(issue.regdate)}
                </small>
              </div>
              <div className="d-flex flex-wrap gap-1">
                {issue.ralated_code_names.split(',').map((code, idx) => (
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
                    {code.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          </a>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default StockIssue;

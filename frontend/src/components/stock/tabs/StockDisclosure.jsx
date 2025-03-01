import { useState, useEffect } from 'react';
import { Table, Spinner } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockDisclosure = ({ stockCode }) => {
  const [disclosures, setDisclosures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await stockService.getStockDart(stockCode);
        setDisclosures(data);
      } catch (err) {
        console.error('공시 데이터 로딩 실패:', err);
        setError('공시 데이터를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    if (stockCode) {
      fetchData();
    }
  }, [stockCode]);

  if (isLoading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger p-3">{error}</div>;
  }

  if (!disclosures?.length) {
    return <div className="text-muted p-3">공시 데이터가 없습니다.</div>;
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>일자</th>
          <th>공시제목</th>
          <th>제출인</th>
        </tr>
      </thead>
      <tbody>
        {disclosures.map((disclosure, index) => (
          <tr key={index}>
            <td style={{ whiteSpace: 'nowrap' }}>
              {new Date(disclosure.rcept_dt).toLocaleDateString()}
            </td>
            <td>
              <a
                href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${disclosure.rcept_no}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none"
              >
                {disclosure.report_nm}
              </a>
            </td>
            <td>{disclosure.corp_name}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default StockDisclosure;

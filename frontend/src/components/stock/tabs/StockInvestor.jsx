import React, { useState, useEffect } from 'react';
import { Table, Spinner } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockInvestor = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatNumber = (num) => {
    if (!num) return '-';
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const getValueColor = (value) => {
    if (!value) return '';
    return value > 0 ? 'text-danger' : value < 0 ? 'text-primary' : '';
  };

  const getBarStyle = (value) => {
    if (!value) return {};
    const absValue = Math.abs(value);
    const maxValue = Math.max(
      ...data.map((item) =>
        Math.max(
          Math.abs(item.개인 || 0),
          Math.abs(item.외국인 || 0),
          Math.abs(item.기관합계 || 0),
          Math.abs(item.금융투자 || 0)
        )
      )
    );

    const width = (absValue / maxValue) * 50; // 최대 50% 너비

    return {
      background: value > 0 ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 0, 255, 0.1)',
      width: `${width}%`,
      height: '100%',
      position: 'absolute',
      top: 0,
      [value > 0 ? 'right' : 'left']: '50%',
      zIndex: 0,
    };
  };

  useEffect(() => {
    console.log('===== StockInvestor 마운트 =====');
    console.log('stockCode:', stockCode);

    const fetchData = async () => {
      if (!stockCode) {
        console.log('stockCode가 없어서 요청 취소');
        return;
      }

      console.log('투자자 데이터 요청 시작');
      try {
        setLoading(true);
        setError(null);
        const response = await stockService.getStockInvestor(stockCode);
        console.log('투자자 데이터 응답:', response);
        console.log('응답 데이터:', response.data);
        setData(response.data);
      } catch (err) {
        console.error('투자자 데이터 요청 실패:', err);
        console.error('에러 상세:', err.response || err.message);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  // 데이터 정렬 추가
  const sortedData = data
    ? [...data].sort((a, b) => {
        return new Date(b.date) - new Date(a.date); // 날짜 내림차순 정렬
      })
    : [];

  if (loading) {
    return (
      <div className="text-center p-3">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger">{error}</div>;
  }

  if (!data) {
    return <div>데이터가 없습니다.</div>;
  }

  return (
    <Table striped bordered hover responsive className="mb-0">
      <thead>
        <tr>
          <th className="text-center">날짜</th>
          <th className="text-center">개인</th>
          <th className="text-center">외국인</th>
          <th className="text-center">기관합계</th>
          <th className="text-center">금융투자</th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map((item) => (
          <tr key={item.date}>
            <td className="text-center">{item.date}</td>
            {['개인', '외국인', '기관합계', '금융투자'].map((investor) => (
              <td
                key={investor}
                className={`text-end position-relative ${getValueColor(
                  item[investor]
                )}`}
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                <div style={getBarStyle(item[investor])} />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: '0 4px',
                  }}
                >
                  {formatNumber(item[investor])}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default StockInvestor;

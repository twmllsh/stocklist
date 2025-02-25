import React, { useState, useEffect } from 'react';
import { Spinner, Table } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockInvestor = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!stockCode) return;

      try {
        setLoading(true);
        const response = await stockService.getStockInvestor(stockCode);
        // console.log('투자자 데이터 응답:', response);
        setData(response);
      } catch (err) {
        // console.error('투자자 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  // 컬럼 순서 정의
  const columnOrder = ['개인', '외국인', '기관합계', '금융투자'];

  const getValueStyle = (value, columnValues) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue === 0) return {};

    // 해당 컬럼의 최대/최소값 계산
    const maxAbs = Math.max(...columnValues.map(Math.abs));
    const percentage = (Math.abs(numValue) / maxAbs) * 100;

    // 양수는 빨간색, 음수는 파란색 그라데이션
    const color = numValue > 0 ? '#d63031' : '#0984e3';
    const gradient =
      numValue > 0
        ? `linear-gradient(90deg, rgba(255,0,0,0.1) ${percentage}%, transparent ${percentage}%)`
        : `linear-gradient(90deg, rgba(0,0,255,0.1) ${percentage}%, transparent ${percentage}%)`;

    return {
      color: color,
      background: gradient,
      fontWeight: Math.abs(numValue) > maxAbs * 0.7 ? 'bold' : 'normal',
      textAlign: 'right',
      padding: '0.25rem 0.5rem', // 패딩 축소
      fontSize: '0.875rem', // 글자 크기 축소
    };
  };

  // 숫자 포맷팅 함수
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const abs = Math.abs(num);
    if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || !data.data || !data.data.length)
    return <div>투자자 데이터가 없습니다.</div>;

  // 데이터 날짜 기준 내림차순 정렬
  const sortedData = [...data.data].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  // 각 컬럼별 데이터 배열 생성
  const columnData = {};
  data.columns.forEach((column) => {
    columnData[column] = data.data.map((row) => Number(row[column]));
  });

  // 컬럼 데이터 정렬
  const sortedColumns = data.columns.sort((a, b) => {
    const indexA = columnOrder.indexOf(a);
    const indexB = columnOrder.indexOf(b);
    return indexA - indexB;
  });

  return (
    <div className="table-responsive">
      <Table bordered hover size="sm" className="small">
        <thead className="bg-light">
          <tr>
            <th
              className="text-center"
              style={{
                padding: '0.25rem',
                fontSize: '0.875rem',
                width: '80px',
              }}
            >
              날짜
            </th>
            {sortedColumns.map((column) => (
              <th
                key={column}
                className="text-center"
                style={{
                  padding: '0.25rem',
                  fontSize: '0.875rem',
                  width: '100px',
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr key={row.date}>
              <td
                className="text-center"
                style={{ padding: '0.25rem', fontSize: '0.875rem' }}
              >
                {row.date}
              </td>
              {sortedColumns.map((column) => (
                <td
                  key={column}
                  style={getValueStyle(row[column], columnData[column])}
                >
                  {formatNumber(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default StockInvestor;

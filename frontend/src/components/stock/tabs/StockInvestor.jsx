import React, { useState, useEffect, useRef } from 'react';
import { Spinner, Table } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockInvestor = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const tableRef = useRef(null);

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

  // 컬럼 순서 수정
  const columnOrder = [
    '개인',
    '외국인',
    '기관합계',
    '투신',
    '금융투자',
    '연기금',
    '사모',
    '보험',
    '은행',
    '기타법인',
    '기타외국인',
    '기타금융',
  ];

  const getValueStyle = (value, columnValues) => {
    if (value === null || value === undefined) return {};

    const numValue = Number(value);
    if (isNaN(numValue)) return {};

    return {
      position: 'relative',
      color: numValue > 0 ? '#d63031' : '#0984e3',
      textAlign: 'right',
      padding: '0.25rem 0.2rem', // 패딩 더 축소
      fontSize: '0.7rem', // 폰트 크기 더 축소
      overflow: 'hidden',
      minWidth: '70px', // 최소 너비 더 축소
      maxWidth: '80px', // 최대 너비 더 축소
      whiteSpace: 'nowrap',
    };
  };

  const getBarStyle = (value, columnValues) => {
    if (value === null || value === undefined) return {};

    const numValue = Number(value);
    if (isNaN(numValue)) return {};

    const maxAbs = Math.max(
      ...columnValues.filter((v) => !isNaN(Number(v))).map(Math.abs)
    );
    const percentage = maxAbs === 0 ? 0 : (Math.abs(numValue) / maxAbs) * 100;

    return {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: numValue < 0 ? 'auto' : 0,
      right: numValue < 0 ? 0 : 'auto',
      width: `${percentage}%`,
      backgroundColor:
        numValue > 0 ? 'rgba(214, 48, 49, 0.1)' : 'rgba(9, 132, 227, 0.1)',
      zIndex: 1,
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

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - tableRef.current.offsetLeft);
    setScrollLeft(tableRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - tableRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    tableRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - tableRef.current.offsetLeft);
    setScrollLeft(tableRef.current.scrollLeft);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - tableRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    tableRef.current.scrollLeft = scrollLeft - walk;
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
    <div
      ref={tableRef}
      style={{
        overflowX: 'auto',
        maxWidth: '100%',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      <Table
        bordered
        hover
        size="sm"
        className="small"
        style={{
          minWidth: '900px', // 전체 테이블 최소 너비 축소
          fontSize: '0.7rem', // 전체 폰트 크기 축소
        }}
      >
        <thead className="bg-light text-center">
          <tr>
            <th
              style={{
                position: 'sticky',
                left: 0,
                backgroundColor: '#f8f9fa',
                zIndex: 3,
                minWidth: '60px', // 날짜 컬럼 너비 더 축소
                maxWidth: '65px',
                fontSize: '0.7rem',
                padding: '0.25rem 0.2rem', // 패딩 더 축소
              }}
            >
              날짜
            </th>
            {sortedColumns.map((column) => (
              <th
                key={column}
                style={{
                  minWidth: '70px', // 컬럼 너비 더 축소
                  maxWidth: '80px',
                  padding: '0.25rem 0.2rem',
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
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
                style={{
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#fff',
                  zIndex: 2,
                  textAlign: 'center',
                  padding: '0.25rem 0.2rem',
                  fontSize: '0.7rem',
                  minWidth: '60px',
                  maxWidth: '65px',
                }}
              >
                {row.date}
              </td>
              {sortedColumns.map((column) => (
                <td
                  key={column}
                  style={getValueStyle(row[column], columnData[column])}
                >
                  <div style={getBarStyle(row[column], columnData[column])} />
                  <span style={{ position: 'relative', zIndex: 2 }}>
                    {formatNumber(row[column])}
                  </span>
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

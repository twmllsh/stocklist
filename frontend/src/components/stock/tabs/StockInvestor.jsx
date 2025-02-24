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

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || !data.data || !data.data.length)
    return <div>투자자 데이터가 없습니다.</div>;

  return (
    <div>
      <Table striped bordered hover size="sm">
        <thead>
          <tr>
            <th>날짜</th>
            {data.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, index) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              {data.columns.map((column) => (
                <td key={column}>{row[column]?.toLocaleString() || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default StockInvestor;

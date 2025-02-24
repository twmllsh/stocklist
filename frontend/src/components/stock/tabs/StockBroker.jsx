import React, { useState, useEffect } from 'react';
import { Spinner, Table } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';

const StockBroker = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 데이터를 날짜별로 그룹화하는 함수
  const groupByDate = (data) => {
    return data.reduce((acc, curr) => {
      if (!acc[curr.date]) {
        acc[curr.date] = [];
      }
      acc[curr.date].push(curr);
      return acc;
    }, {});
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!stockCode) return;

      try {
        setLoading(true);
        const response = await stockService.getStockBroker(stockCode);
        // console.log('거래원 데이터:', response);
        setData(response);
      } catch (err) {
        console.error('거래원 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data) return <div>거래원 데이터가 없습니다.</div>;

  const groupedData = groupByDate(data);
  const dates = Object.keys(groupedData).sort().reverse();

  return (
    <div>
      {dates.map((date) => (
        <div key={date} className="mb-4">
          <h6 className="mb-3">{date}</h6>
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>증권사</th>
                <th className="text-end">매수</th>
                <th className="text-end">매도</th>
                <th className="text-end">순매수</th>
              </tr>
            </thead>
            <tbody>
              {groupedData[date].map((item) => {
                const buy = item.buy || 0;
                const sell = item.sell || 0;
                const netBuy = buy - sell;

                return (
                  <tr key={item.id}>
                    <td>{item.broker_name}</td>
                    <td className="text-end">
                      {buy ? buy.toLocaleString() : '-'}
                    </td>
                    <td className="text-end">
                      {sell ? sell.toLocaleString() : '-'}
                    </td>
                    <td
                      className={`text-end ${
                        netBuy > 0
                          ? 'text-danger'
                          : netBuy < 0
                          ? 'text-primary'
                          : ''
                      }`}
                    >
                      {netBuy ? netBuy.toLocaleString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
};

export default StockBroker;

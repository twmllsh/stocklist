import React, { useState, useEffect } from 'react';
import { Spinner, Table } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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

  const prepareBrokerChart = (brokerData, brokerName) => {
    if (!brokerData?.length) return null;

    const filteredData = brokerData.filter(
      (item) => item.broker_name === brokerName
    );
    const dates = filteredData.map((item) => item.date);

    return {
      labels: dates,
      datasets: [
        {
          label: '매수',
          data: filteredData.map((item) => item.buy || 0),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
        {
          label: '매도',
          data: filteredData.map((item) => item.sell || 0),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        },
        {
          label: '순매수',
          data: filteredData.map((item) => (item.buy || 0) - (item.sell || 0)),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || !data.length) return <div>거래원 데이터가 없습니다.</div>;

  // 데이터 처리 로직을 렌더링 이전에 수행
  const brokers = [...new Set(data.map((item) => item.broker_name))];
  const groupedData = groupByDate(data);
  const dates = Object.keys(groupedData).sort().reverse();

  return (
    <div className="d-flex flex-column gap-4">
      {/* 차트 섹션 */}
      <div className="broker-charts">
        {brokers.map((broker) => (
          <div key={broker} style={{ height: '300px', marginBottom: '2rem' }}>
            <h6 className="text-center mb-3">{broker}</h6>
            <Line
              data={prepareBrokerChart(data, broker)}
              options={chartOptions}
            />
          </div>
        ))}
      </div>

      {/* 테이블 섹션 */}
      <div className="table-responsive">
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
    </div>
  );
};

export default StockBroker;

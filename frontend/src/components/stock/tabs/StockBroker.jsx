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

  const prepareBrokerData = (data) => {
    // 거래원별로 데이터 그룹화
    const brokerGroups = {};

    // 모든 날짜를 수집하고 정렬
    const allDates = [...new Set(data.map((item) => item.date))].sort();

    // 각 거래원별 데이터 초기화
    data.forEach((item) => {
      if (!brokerGroups[item.broker_name]) {
        brokerGroups[item.broker_name] = {
          dates: allDates,
          buys: Array(allDates.length).fill(0),
          sells: Array(allDates.length).fill(0),
        };
      }

      const dateIndex = allDates.indexOf(item.date);
      if (dateIndex !== -1) {
        brokerGroups[item.broker_name].buys[dateIndex] = item.buy || 0;
        brokerGroups[item.broker_name].sells[dateIndex] = item.sell || 0;
      }
    });

    return { brokerGroups, allDates };
  };

  const createChartData = (brokerData) => ({
    labels: brokerData.dates,
    datasets: [
      {
        label: '매수',
        data: brokerData.buys,
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.1,
      },
      {
        label: '매도',
        data: brokerData.sells,
        borderColor: '#2962FF',
        backgroundColor: 'rgba(41, 98, 255, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.1,
      },
    ],
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          callback: (value) => value.toLocaleString(),
        },
      },
    },
  };

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || !data.length) return <div>거래원 데이터가 없습니다.</div>;

  const { brokerGroups, allDates } = prepareBrokerData(data);
  const groupedData = groupByDate(data);
  const sortedDates = allDates.sort().reverse();

  return (
    <div className="d-flex flex-column gap-4">
      {/* 차트 섹션 */}
      {Object.entries(brokerGroups).map(([brokerName, brokerData]) => (
        <div key={brokerName} style={{ marginBottom: '2rem' }}>
          <h6 className="text-center mb-3">{brokerName}</h6>
          <div style={{ height: '300px', position: 'relative' }}>
            <Line data={createChartData(brokerData)} options={options} />
          </div>
        </div>
      ))}

      {/* 테이블 섹션 */}
      <div className="table-responsive">
        {sortedDates.map((date) => (
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

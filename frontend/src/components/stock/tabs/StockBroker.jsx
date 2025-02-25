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

  // 차트 데이터 준비 함수 수정
  const prepareBrokerCharts = (brokerData) => {
    if (!brokerData?.length) return [];

    // 모든 날짜 추출 및 정렬
    const dates = [...new Set(brokerData.map((item) => item.date))].sort();

    // 거래원별로 데이터 그룹화
    const brokerGroups = {};
    brokerData.forEach((item) => {
      const { broker_name, date, buy = 0, sell = 0 } = item;
      if (!brokerGroups[broker_name]) {
        brokerGroups[broker_name] = {
          dates: dates,
          buys: Array(dates.length).fill(0),
          sells: Array(dates.length).fill(0),
          netBuys: Array(dates.length).fill(0),
        };
      }

      const dateIndex = dates.indexOf(date);
      if (dateIndex !== -1) {
        brokerGroups[broker_name].buys[dateIndex] = buy;
        brokerGroups[broker_name].sells[dateIndex] = sell;
        brokerGroups[broker_name].netBuys[dateIndex] = buy - sell;
      }
    });

    // 각 거래원별 차트 데이터 생성
    return Object.entries(brokerGroups).map(([broker, data]) => ({
      broker,
      chartData: {
        labels: data.dates,
        datasets: [
          {
            label: '매수',
            data: data.buys,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
          },
          {
            label: '매도',
            data: data.sells,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
          },
          {
            label: '순매수',
            data: data.netBuys,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
          },
        ],
      },
    }));
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data || !data.length) return <div>거래원 데이터가 없습니다.</div>;

  const brokerCharts = prepareBrokerCharts(data);
  const groupedData = groupByDate(data);
  const dates = Object.keys(groupedData).sort().reverse();

  return (
    <div>
      {/* 거래원별 차트 표시 */}
      <div className="broker-charts mb-4">
        {brokerCharts.map(({ broker, chartData }) => (
          <div key={broker} className="mb-4">
            <h6>{broker}</h6>
            <div style={{ height: '200px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        ))}
      </div>

      {/* 기존 테이블 표시 */}
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

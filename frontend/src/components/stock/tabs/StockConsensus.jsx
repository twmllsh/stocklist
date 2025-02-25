import React, { useState, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

const StockConsensus = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!stockCode) return;
      try {
        setLoading(true);
        const response = await stockService.getStockConsensus(stockCode);
        setData(response);
      } catch (err) {
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [stockCode]);

  const processChartData = (rawData, type) => {
    const filtered = rawData
      .filter((item) =>
        type === 'yearly'
          ? item.fintype === '연결연도' && item.quarter === 0
          : item.fintype === '연결분기' && [3, 6, 9, 12].includes(item.quarter)
      )
      .sort((a, b) => a.year - b.year);

    return {
      labels: filtered.map((item) =>
        type === 'yearly' ? String(item.year) : `${item.year}-${item.quarter}Q`
      ),
      datasets: [
        {
          label: '매출액',
          data: filtered.map((item) => Number(item.매출액 || 0)),
          borderColor: '#2962FF',
          backgroundColor: 'rgba(41, 98, 255, 0.1)',
        },
        {
          label: '영업이익',
          data: filtered.map((item) => Number(item.영업이익 || 0)),
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
        },
        {
          label: '당기순이익',
          data: filtered.map((item) => Number(item.당기순이익 || 0)),
          borderColor: '#51CF66',
          backgroundColor: 'rgba(81, 207, 102, 0.1)',
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
  if (!data || !data.length) return <div>컨센서스 데이터가 없습니다.</div>;

  return (
    <div className="d-flex flex-column gap-4">
      <div style={{ height: '400px' }}>
        <h6 className="text-center mb-3">연간 실적/전망</h6>
        <Line data={processChartData(data, 'yearly')} options={chartOptions} />
      </div>
      <div style={{ height: '400px' }}>
        <h6 className="text-center mb-3">분기 실적/전망</h6>
        <Line
          data={processChartData(data, 'quarterly')}
          options={chartOptions}
        />
      </div>
    </div>
  );
};

export default StockConsensus;

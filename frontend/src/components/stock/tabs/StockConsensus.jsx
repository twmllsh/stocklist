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
    if (type === 'yearly') {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const targetYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

      const filtered = rawData
        .filter((item) => item.fintype === '연결연도' && item.quarter === 0)
        .sort((a, b) => a.year - b.year);

      return {
        labels: filtered.map((item) => `${item.year}`),
        datasets: [
          {
            type: 'line',
            label: '매출액',
            data: filtered.map((item) => Number(item.매출액 || 0)),
            borderColor: '#2962FF',
            pointBackgroundColor: filtered.map((item) =>
              Number(item.year) === targetYear ? '#2962FF' : 'transparent'
            ),
            pointRadius: filtered.map((item) =>
              Number(item.year) === targetYear ? 6 : 4
            ),
            pointBorderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 2 : 1
            ),
            borderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 3 : 1
            ),
            yAxisID: 'y-axis-1',
          },
          {
            type: 'line',
            label: '영업이익',
            data: filtered.map((item) => Number(item.영업이익 || 0)),
            borderColor: '#FF6B6B',
            pointBackgroundColor: filtered.map((item) =>
              Number(item.year) === targetYear ? '#FF6B6B' : 'transparent'
            ),
            pointRadius: filtered.map((item) =>
              Number(item.year) === targetYear ? 6 : 4
            ),
            pointBorderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 2 : 1
            ),
            borderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 3 : 1
            ),
            yAxisID: 'y-axis-2',
          },
          {
            type: 'line',
            label: '당기순이익',
            data: filtered.map((item) => Number(item.당기순이익 || 0)),
            borderColor: '#51CF66',
            pointBackgroundColor: filtered.map((item) =>
              Number(item.year) === targetYear ? '#51CF66' : 'transparent'
            ),
            pointRadius: filtered.map((item) =>
              Number(item.year) === targetYear ? 6 : 4
            ),
            pointBorderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 2 : 1
            ),
            borderWidth: filtered.map((item) =>
              Number(item.year) === targetYear ? 3 : 1
            ),
            yAxisID: 'y-axis-2',
          },
        ],
      };
    }

    const filtered = rawData
      .filter((item) =>
        type === 'yearly'
          ? item.fintype === '연결연도' && item.quarter === 0
          : item.fintype === '연결분기' && [3, 6, 9, 12].includes(item.quarter)
      )
      .sort((a, b) =>
        type === 'yearly'
          ? a.year - b.year
          : a.year * 4 +
            Math.floor(a.quarter / 3) -
            (b.year * 4 + Math.floor(b.quarter / 3))
      );

    return {
      labels: filtered.map((item) =>
        type === 'yearly' ? `${item.year}` : `${item.year}-${item.quarter}Q`
      ),
      datasets: [
        {
          label: '매출액',
          data: filtered.map((item) => Number(item.매출액 || 0)),
          borderColor: '#2962FF',
          backgroundColor: 'rgba(41, 98, 255, 0.5)',
          yAxisID: 'y-axis-1',
        },
        {
          label: '영업이익',
          data: filtered.map((item) => Number(item.영업이익 || 0)),
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.5)',
          yAxisID: 'y-axis-2',
        },
        {
          label: '당기순이익',
          data: filtered.map((item) => Number(item.당기순이익 || 0)),
          borderColor: '#51CF66',
          backgroundColor: 'rgba(81, 207, 102, 0.5)',
          yAxisID: 'y-axis-2',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
              const value = context.parsed.y;
              if (value >= 1000000) {
                label += (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                label += (value / 1000).toFixed(1) + 'K';
              } else {
                label += value.toFixed(0);
              }
            }
            return label;
          },
        },
      },
    },
    scales: {
      'y-axis-1': {
        type: 'linear',
        position: 'left',
        ticks: {
          callback: function (value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          },
        },
      },
      'y-axis-2': {
        type: 'linear',
        position: 'right',
        ticks: {
          callback: function (value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          },
        },
      },
    },
  };

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data) return <div>컨센서스 데이터가 없습니다.</div>;

  const yearlyData = processChartData(data, 'yearly');
  const quarterlyData = processChartData(data, 'quarterly');

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-center mb-3">연간 실적/전망</h6>
        <Line data={yearlyData} options={chartOptions} height={300} />
      </div>
      <div>
        <h6 className="text-center mb-3">분기 실적/전망</h6>
        <Line data={quarterlyData} options={chartOptions} height={300} />
      </div>
    </div>
  );
};

export default StockConsensus;

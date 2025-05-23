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

  // 현재 분기와 다음 분기를 구하는 함수 추가
  const getCurrentQuarter = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    return {
      year: currentYear,
      quarter: currentQuarter,
    };
  };

  // 다음 분기를 구하는 함수
  const getNextQuarter = (year, quarter) => {
    if (quarter === 4) {
      return { year: year + 1, quarter: 1 };
    }
    return { year: year, quarter: quarter + 1 };
  };

  const processChartData = (rawData, type) => {
    if (type === 'yearly') {
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
            backgroundColor: 'rgba(41, 98, 255, 0.1)',
            borderWidth: 2,
            yAxisID: 'y-axis-1',
          },
          {
            type: 'line',
            label: '영업이익',
            data: filtered.map((item) => Number(item.영업이익 || 0)),
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 2,
            yAxisID: 'y-axis-2',
          },
          {
            type: 'line',
            label: '당기순이익',
            data: filtered.map((item) => Number(item.당기순이익 || 0)),
            borderColor: '#51CF66',
            backgroundColor: 'rgba(81, 207, 102, 0.1)',
            borderWidth: 2,
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
      .sort((a, b) => {
        // 연도와 분기로 정렬
        if (a.year !== b.year) return a.year - b.year;
        return a.quarter - b.quarter;
      });

    return {
      labels: filtered.map((item) =>
        type === 'yearly'
          ? String(item.year)
          : `${item.year}-${Math.floor(item.quarter / 3)}Q`
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
      x: {
        grid: {
          color: (context) => {
            if (!context.tick?.label) return 'rgba(0, 0, 0, 0.1)';

            // 현재 연도와 분기 구하기
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

            // 다음 분기 계산
            let nextQuarter = currentQuarter + 1;
            let nextQuarterYear = currentYear;
            if (nextQuarter > 4) {
              nextQuarter = 1;
              nextQuarterYear = currentYear + 1;
            }

            // x축 라벨 파싱 (예: "2024-1Q")
            const [labelYear, quarterLabel] = context.tick.label.split('-');
            const labelQuarter = quarterLabel ? parseInt(quarterLabel) : null;

            // 연간 차트의 경우 기존 로직 유지
            if (!quarterLabel) {
              return parseInt(labelYear) === currentYear + 1
                ? 'rgba(41, 98, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.1)';
            }

            // 다음 분기이거나 다음 분기의 작년 동기 확인
            const isNextQuarter =
              parseInt(labelYear) === nextQuarterYear &&
              labelQuarter === nextQuarter;
            const isPreviousYearSameQuarter =
              parseInt(labelYear) === nextQuarterYear - 1 &&
              labelQuarter === nextQuarter;

            if (isNextQuarter || isPreviousYearSameQuarter)
              return 'rgba(41, 98, 255, 0.2)';
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context) => {
            // 위의 color 로직과 동일한 조건 적용
            if (!context.tick?.label) return 1;

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

            let nextQuarter = currentQuarter + 1;
            let nextQuarterYear = currentYear;
            if (nextQuarter > 4) {
              nextQuarter = 1;
              nextQuarterYear = currentYear + 1;
            }

            const [labelYear, quarterLabel] = context.tick.label.split('-');
            const labelQuarter = quarterLabel ? parseInt(quarterLabel) : null;

            if (!quarterLabel) {
              return parseInt(labelYear) === currentYear + 1 ? 40 : 1;
            }

            const isNextQuarter =
              parseInt(labelYear) === nextQuarterYear &&
              labelQuarter === nextQuarter;
            const isPreviousYearSameQuarter =
              parseInt(labelYear) === nextQuarterYear - 1 &&
              labelQuarter === nextQuarter;

            if (isNextQuarter || isPreviousYearSameQuarter) return 40;
            return 1;
          },
        },
      },
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
  if (!data || !data.length) return <div>컨센서스 데이터가 없습니다.</div>;

  return (
    <div
      className="d-flex flex-column"
      style={{ gap: '3rem', paddingBottom: '2rem' }}
    >
      <div
        style={{
          height: '400px',
          padding: '1rem',
          backgroundColor: 'var(--bs-body-bg)',
          borderRadius: '8px',
        }}
      >
        <h6 className="text-center mb-4">연간 실적/전망</h6>
        <Line data={processChartData(data, 'yearly')} options={chartOptions} />
      </div>
      <div
        style={{
          height: '400px',
          padding: '1rem',
          backgroundColor: 'var(--bs-body-bg)',
          borderRadius: '8px',
          marginBottom: '1.5rem', // x축 라벨을 위한 추가 여백
        }}
      >
        <h6 className="text-center mb-4">분기 실적/전망</h6>
        <Line
          data={processChartData(data, 'quarterly')}
          options={chartOptions}
        />
      </div>
    </div>
  );
};

export default StockConsensus;

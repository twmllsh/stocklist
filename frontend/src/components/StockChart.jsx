import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { stockService } from '../services/stockService';
import { Button, ButtonGroup, Card } from 'react-bootstrap';

const StockChart = ({ symbol, name }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeries = useRef(null);
  const [timeframe, setTimeframe] = useState('daily'); // daily, 5m, 30m
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        backgroundColor: '#ffffff',
        textColor: '#333',
      },
      grid: {
        vertLines: {
          color: '#f0f0f0',
        },
        horzLines: {
          color: '#f0f0f0',
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // 캔들스틱 시리즈 추가
    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // 참조 저장
    chartRef.current = chart;
    candleSeries.current = series;

    // 차트 크기 조정 이벤트 리스너
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 데이터 로드
    loadChartData();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol]); // symbol이 변경될 때만 차트 재생성

  // 타임프레임이 변경될 때 데이터 다시 로드
  useEffect(() => {
    if (candleSeries.current) {
      loadChartData();
    }
  }, [timeframe]);

  // 차트 데이터 로드 함수
  const loadChartData = async () => {
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      // 타임프레임을 API에 맞게 변환
      let interval;
      switch (timeframe) {
        case '5m':
          interval = '5min';
          break;
        case '30m':
          interval = '30min';
          break;
        case '60m':
          interval = '60min';
          break;
        default:
          interval = 'day';
      }

      console.log(`차트 데이터 요청: ${symbol}, 인터벌: ${interval}`);

      // 기존 getStockOhlcv 함수 사용
      const response = await stockService.getStockOhlcv(symbol, interval);

      if (response.data && response.data.length > 0) {
        console.log(`${interval} 데이터 가져옴: ${response.data.length}개`);

        // 데이터 포맷 변환 (API 응답에 따라 조정)
        const chartData = response.data.map((item) => ({
          time: item.date || item.time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume || 0),
        }));

        // 데이터 정렬 (시간 오름차순)
        chartData.sort((a, b) => {
          // ISO 형식 날짜 또는 유닉스 타임스탬프 처리
          const timeA = typeof a.time === 'string' ? new Date(a.time) : a.time;
          const timeB = typeof b.time === 'string' ? new Date(b.time) : b.time;
          return timeA - timeB;
        });

        // 차트에 데이터 설정
        candleSeries.current.setData(chartData);

        // 마지막 데이터로 타임스케일 조정
        chartRef.current.timeScale().fitContent();
      } else {
        console.warn(`${interval} 데이터가 없습니다.`);
        setError('데이터가 없습니다.');
      }
    } catch (err) {
      console.error('차트 데이터 로드 오류:', err);
      console.error('오류 세부 정보:', err.response?.data || err.message);
      setError(`차트 데이터를 불러오는 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 타임프레임 변경 핸들러
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  return (
    <Card className="mb-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{name || symbol} 차트</h5>
        <ButtonGroup size="sm">
          <Button
            variant={timeframe === 'daily' ? 'primary' : 'outline-primary'}
            onClick={() => handleTimeframeChange('daily')}
          >
            일봉
          </Button>
          <Button
            variant={timeframe === '30m' ? 'primary' : 'outline-primary'}
            onClick={() => handleTimeframeChange('30m')}
          >
            30분봉
          </Button>
          <Button
            variant={timeframe === '5m' ? 'primary' : 'outline-primary'}
            onClick={() => handleTimeframeChange('5m')}
          >
            5분봉
          </Button>
        </ButtonGroup>
      </Card.Header>
      <Card.Body>
        {loading && <div className="text-center my-3">로딩 중...</div>}
        {error && <div className="text-danger text-center my-3">{error}</div>}
        <div
          ref={chartContainerRef}
          className="stock-chart-container"
          style={{ height: '400px' }}
        />
      </Card.Body>
    </Card>
  );
};

export default StockChart;

import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { createChart } from 'lightweight-charts';
import { stockService } from '../../../services/stockService';

const StockConsensus = ({ stockCode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const yearlyChartRef = useRef(null);
  const quarterlyChartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      console.log('===== 컨센서스 데이터 요청 시작 =====');
      if (!stockCode) return;

      try {
        setLoading(true);
        const data = await stockService.getStockConsensus(stockCode);
        console.log('컨센서스 데이터:', data);
        setData(data);
      } catch (err) {
        console.error('컨센서스 데이터 요청 실패:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stockCode]);

  const processChartData = (rawData, type) => {
    console.log(`Processing ${type} data:`, rawData);

    const filtered = rawData
      .filter((item) => {
        if (type === 'yearly') {
          return item.fintype === '연결연도' && item.quarter === 0;
        }
        return (
          item.fintype === '연결분기' && [3, 6, 9, 12].includes(item.quarter)
        );
      })
      .sort((a, b) => {
        if (type === 'yearly') {
          return a.year - b.year;
        }
        // 분기 데이터는 년도와 분기를 숫자로 결합하여 정렬
        const timeA = Number(
          String(a.year) + String(a.quarter).padStart(2, '0')
        );
        const timeB = Number(
          String(b.year) + String(b.quarter).padStart(2, '0')
        );
        return timeA - timeB;
      });

    return filtered.map((item) => ({
      time:
        type === 'yearly'
          ? Number(item.year)
          : Number(String(item.year) + String(item.quarter).padStart(2, '0')),
      매출액: Number(item.매출액 || 0),
      영업이익: Number(item.영업이익 || 0),
      당기순이익: Number(item.당기순이익 || 0),
    }));
  };

  const createConsensusChart = (container, chartData, title) => {
    if (!chartData || chartData.length === 0) return null;

    // 범례 컨테이너 생성
    const legendContainer = document.createElement('div');
    legendContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 4px;
      z-index: 3;
    `;
    container.appendChild(legendContainer);

    const chart = createChart(container, {
      height: 300,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#e1e4e8',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#e1e4e8',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      grid: {
        horzLines: { color: '#f0f3fa' },
        vertLines: { color: '#f0f3fa' },
      },
      timeScale: {
        borderColor: '#e1e4e8',
        visible: true,
        barSpacing: 40,
        minBarSpacing: 10,
        rightOffset: 10,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time) => {
          if (time < 3000) return String(time);
          const timeStr = String(time);
          const year = timeStr.slice(0, 4);
          const quarter = Math.floor(Number(timeStr.slice(4)) / 3);
          return `${year}/${quarter}Q`;
        },
      },
    });

    // 시리즈 설정
    const seriesConfigs = [
      { name: '매출액', color: '#2962FF', scaleId: 'left' },
      { name: '영업이익', color: '#FF6B6B', scaleId: 'right' },
      { name: '당기순이익', color: '#51CF66', scaleId: 'right' },
    ];

    // 범례 아이템 생성 함수
    const createLegendItem = (name, color) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        cursor: pointer;
      `;

      const marker = document.createElement('span');
      marker.style.cssText = `
        width: 8px;
        height: 8px;
        background-color: ${color};
        margin-right: 4px;
        border-radius: 50%;
      `;

      const label = document.createElement('span');
      label.textContent = name;

      item.appendChild(marker);
      item.appendChild(label);
      return item;
    };

    seriesConfigs.forEach(({ name, color, scaleId }) => {
      const series = chart.addLineSeries({
        title: name,
        color: color,
        lineWidth: 2,
        priceScaleId: scaleId,
        crosshairMarkerVisible: true,
        lastValueVisible: false, // 라벨 숨김
        priceLineVisible: false, // 가격선 숨김
        axisLabelVisible: false, // 축 라벨 숨김
        priceFormat: {
          type: 'volume',
          precision: 0,
        },
        markers: chartData.map((d) => ({
          time: d.time,
          position: 'top',
          color: color,
          shape: 'circle',
          size: 4,
        })),
      });

      series.setData(
        chartData.map((d) => ({
          time: d.time,
          value: d[name],
        }))
      );

      // 범례 아이템 추가
      const legendItem = createLegendItem(name, color);
      legendContainer.appendChild(legendItem);

      // 범례 클릭 이벤트
      let isVisible = true;
      legendItem.addEventListener('click', () => {
        isVisible = !isVisible;
        series.applyOptions({ visible: isVisible });
        legendItem.style.opacity = isVisible ? '1' : '0.4';
      });
    });

    chart.timeScale().fitContent();
    return chart;
  };

  useEffect(() => {
    if (!data || loading) return;

    // 차트 컨테이너 초기화
    const yearlyContainer = document.getElementById('yearlyChart');
    const quarterlyContainer = document.getElementById('quarterlyChart');

    const yearlyData = processChartData(data, 'yearly');
    const quarterlyData = processChartData(data, 'quarterly');

    console.log('연간 데이터:', yearlyData);
    console.log('분기 데이터:', quarterlyData);

    if (yearlyData.length > 0) {
      yearlyChartRef.current = createConsensusChart(
        yearlyContainer,
        yearlyData,
        '연간'
      );
    }

    if (quarterlyData.length > 0) {
      quarterlyChartRef.current = createConsensusChart(
        quarterlyContainer,
        quarterlyData,
        '분기'
      );
    }

    return () => {
      if (yearlyChartRef.current) yearlyChartRef.current.remove();
      if (quarterlyChartRef.current) quarterlyChartRef.current.remove();
    };
  }, [data, loading]);

  if (loading) return <Spinner animation="border" variant="primary" />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data) return <div>컨센서스 데이터가 없습니다.</div>;

  return (
    <div>
      <div>
        <h6 className="text-center mb-3">연간 실적/전망</h6>
        <div
          id="yearlyChart"
          style={{ height: '300px', position: 'relative' }}
        />
      </div>
      <div className="mt-4">
        <h6 className="text-center mb-3">분기 실적/전망</h6>
        <div
          id="quarterlyChart"
          style={{ height: '300px', position: 'relative' }}
        />
      </div>
    </div>
  );
};

export default StockConsensus;

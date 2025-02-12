import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

function StockChart({ data, options, stock }) {
  // stock prop 추가
  const containerRef = useRef(null);
  const volumeContainerRef = useRef(null); // 거래량 차트 ref 유지
  const chartRef = useRef(null); // 차트 인스턴스 저장용
  const seriesRef = useRef({}); // 시리즈 참조 저장용
  const chartStateRef = useRef(null); // 차트 상태 저장용

  useEffect(() => {
    if (!data?.length || !containerRef.current || !volumeContainerRef.current)
      return;

    // 차트가 이미 존재하면 시리즈만 업데이트
    if (chartRef.current) {
      // 현재 스크롤/줌 상태 저장
      chartStateRef.current = {
        timeRange: chartRef.current.timeScale().getVisibleRange(),
        logicalRange: chartRef.current.timeScale().getVisibleLogicalRange(),
      };

      // 시리즈 업데이트
      Object.entries(seriesRef.current).forEach(([key, series]) => {
        if (key === 'candle' && series && options.showCandle) {
          series.setData(candleData);
        } else if (
          key.startsWith('ma') &&
          series &&
          options[`show${key.toUpperCase()}`]
        ) {
          series.setData(maData[key]);
        } else if (
          key.startsWith('bb') &&
          series &&
          options[`show${key.toUpperCase()}`]
        ) {
          series.upper.setData(bbData[`${key}Upper`]);
          series.lower.setData(bbData[`${key}Lower`]);
        }
      });

      // 상태 복원
      if (chartStateRef.current) {
        chartRef.current
          .timeScale()
          .setVisibleRange(chartStateRef.current.timeRange);
      }

      return;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300, // 메인 차트 높이
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
        rightOffset: 5, // 오른쪽 여백 5개 캔들만큼 설정
        fixRightEdge: false, // 오른쪽 여백 고정
      },
      crosshair: {
        mode: 1,
        vertLine: {
          labelVisible: false,
        },
      },
      rightPriceScale: {
        visible: false, // 오른쪽 가격 스케일 숨김
      },
      leftPriceScale: {
        visible: true, // 왼쪽 가격 스케일 표시
        borderColor: '#d1d4dc',
      },
    });

    chartRef.current = chart; // 차트 인스턴스 저장

    // 거래량 차트는 항상 생성 (옵션 체크 제거)
    const volumeChart = createChart(volumeContainerRef.current, {
      width: volumeContainerRef.current.clientWidth,
      height: 120, // 거래량 차트 높이
      layout: {
        backgroundColor: '#ffffff',
        textColor: '#333',
      },
      grid: {
        vertLines: {
          visible: false, // 수직 그리드 라인 숨김
        },
        horzLines: {
          color: '#f0f0f0',
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5, // 거래량 차트도 동일하게 설정
        fixRightEdge: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          labelVisible: false,
        },
      },
      rightPriceScale: {
        visible: false, // 오른쪽 가격 스케일 숨김
      },
      leftPriceScale: {
        visible: true, // 왼쪽 스케일 사용
        borderColor: '#d1d4dc',
      },
    });

    // 거래량 20일 이동평균 계산 함수 추가
    const calculateVolumeMA = (data, period) => {
      const result = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          result.push(null);
          continue;
        }
        const sum = data
          .slice(i - period + 1, i + 1)
          .reduce((acc, cur) => acc + cur.volume, 0);
        result.push(sum / period);
      }
      return result;
    };

    const series = {
      candle: options.showCandle
        ? chart.addCandlestickSeries({
            upColor: 'red',
            downColor: 'blue',
            borderVisible: false,
            wickUpColor: 'red',
            wickDownColor: 'blue',
            priceFormat: {
              type: 'price',
              precision: 2,
              minMove: 0.01,
            },
            priceScaleId: 'left', // 왼쪽 스케일 사용
          })
        : null,
      volume: volumeChart.addHistogramSeries({
        // 거래량 시리즈는 항상 생성
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'left', // 왼쪽 스케일 사용
        scaleMargins: {
          top: 0.1, // 여백 조정
          bottom: 0.2,
        },
      }),
      volumeMA20: volumeChart.addLineSeries({
        color: 'rgba(255, 0, 0, 0.8)',
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
      }),
      ma3: options.showMA3
        ? chart.addLineSeries({
            color: 'black',
            lineWidth: 1,
            title: 'MA3',
            priceScaleId: 'left',
            priceFormat: {
              type: 'custom',
              minMove: 0.01,
              formatter: (price) => '', // 가격 표시 숨김
            },
          })
        : null,
      ma20: options.showMA20
        ? chart.addLineSeries({
            color: 'red',
            lineWidth: 3,
            title: 'MA20',
            priceScaleId: 'left',
            priceFormat: {
              type: 'custom',
              minMove: 0.01,
              formatter: (price) => '', // 가격 표시 숨김
            },
          })
        : null,
      ma60: options.showMA60
        ? chart.addLineSeries({
            color: 'blue',
            lineWidth: 2,
            title: 'MA60',
            priceScaleId: 'left',
            priceFormat: {
              type: 'custom',
              minMove: 0.01,
              formatter: (price) => '', // 가격 표시 숨김
            },
          })
        : null,
      ma240: options.showMA240
        ? chart.addLineSeries({
            color: 'gray',
            lineWidth: 3,
            title: 'MA240',
            priceScaleId: 'left',
            priceFormat: {
              type: 'custom',
              minMove: 0.01,
              formatter: (price) => '', // 가격 표시 숨김
            },
          })
        : null,
      bb60: options.showBB60
        ? {
            area: chart.addAreaSeries({
              topColor: 'rgba(26, 129, 255, 0.3)', // 투명도 수정
              bottomColor: 'rgba(26, 129, 255, 0)', // 완전 투명
              lineColor: 'transparent',
              priceScaleId: 'left',
              lastValueVisible: false,
            }),
            upper: chart.addLineSeries({
              color: 'rgba(26, 129, 255, 0.9)',
              lineWidth: 3,
              priceScaleId: 'left',
            }),
            lower: chart.addLineSeries({
              color: 'rgba(26, 129, 255, 0.9)',
              lineWidth: 3,
              priceScaleId: 'left',
            }),
          }
        : null,
      bb240: options.showBB240
        ? {
            area: chart.addAreaSeries({
              topColor: 'rgba(158, 158, 158, 0.4)', // 투명도 수정
              bottomColor: 'rgba(158, 158, 158, 0.0)', // 완전 투명
              lineColor: 'transparent',
              priceScaleId: 'left',
              lastValueVisible: false, // 마지막 값 표시 제거
            }),
            upper: chart.addLineSeries({
              color: 'rgba(158, 158, 158, 0.8)',
              lineWidth: 4,
              priceScaleId: 'left',
            }),
            lower: chart.addLineSeries({
              color: 'rgba(158, 158, 158, 0.8)',
              lineWidth: 4,
              priceScaleId: 'left',
            }),
          }
        : null,
    };

    const candleData = data.map((d) => ({
      time: new Date(d.date).getTime() / 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const timeData = data.map((d) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
    }));

    const ma3Data = data
      .map((d, i) => ({
        ...timeData[i],
        value: d.ma3,
      }))
      .filter((d) => d.value !== null);

    const ma20Data = data
      .map((d, i) => ({
        ...timeData[i],
        value: d.ma20,
      }))
      .filter((d) => d.value !== null);

    const ma60Data = data
      .map((d, i) => ({
        ...timeData[i],
        value: d.ma60,
      }))
      .filter((d) => d.value !== null);

    const ma240Data = data
      .map((d, i) => ({
        ...timeData[i],
        value: d.ma240,
      }))
      .filter((d) => d.value !== null);

    if (series.candle) {
      series.candle.setData(candleData);
    }

    if (series.ma3 && ma3Data.length) {
      series.ma3.setData(ma3Data);
    }
    if (series.ma20 && ma20Data.length) {
      series.ma20.setData(ma20Data);
    }
    if (series.ma60 && ma60Data.length) {
      series.ma60.setData(ma60Data);
    }
    if (series.ma240 && ma240Data.length) {
      series.ma240.setData(ma240Data);
    }

    // 거래량이 기준선을 넘는지 확인
    const hasVolumeOverFloat = data.some(
      (d) => stock?.유통주식수 && d.volume > stock.유통주식수
    );
    const hasVolumeOverTotal = data.some(
      (d) => stock?.상장주식수 && d.volume > stock.상장주식수
    );

    // 거래량 차트에 유통주식수와 상장주식수 라인 추가 (조건부)
    if (hasVolumeOverFloat && stock?.유통주식수) {
      volumeChart
        .addLineSeries({
          color: 'rgba(255, 255, 0, 0.8)',
          lineWidth: 1,
          title: '유통주식수',
          priceScaleId: 'left',
          lineStyle: 2,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
        })
        .setData(
          data.map((d) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            value: stock.유통주식수,
          }))
        );
    }

    if (hasVolumeOverTotal && stock?.상장주식수) {
      volumeChart
        .addLineSeries({
          color: 'rgba(147, 112, 219, 0.8)',
          lineWidth: 1,
          title: '상장주식수',
          priceScaleId: 'left',
          lineStyle: 2,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
        })
        .setData(
          data.map((d) => ({
            time: Math.floor(new Date(d.date).getTime() / 1000),
            value: stock.상장주식수,
          }))
        );
    }

    // 거래량 데이터 포맷팅 및 설정 부분 수정
    const volumeData = data.map((d) => {
      let volumeColor = d.close > d.open ? 'rgba(255,82,82,1)' : 'gray';

      // 거래량이 상장주식수보다 많은 경우 (stock이 존재할 때만 체크)
      if (stock?.상장주식수 && d.volume > stock.상장주식수) {
        volumeColor = 'rgba(147,112,219,0.8)'; // 진보라색
      }
      // 거래량이 유통주식수보다 많은 경우 (stock이 존재할 때만 체크)
      else if (stock?.유통주식수 && d.volume > stock.유통주식수) {
        volumeColor = 'rgba(255,255,0,0.8)'; // 노란색
      }

      return {
        time: Math.floor(new Date(d.date).getTime() / 1000),
        value: d.volume,
        color: volumeColor,
      };
    });

    // 거래량 데이터 설정 후 MA20 라인 추가
    const volumeMA20Data = calculateVolumeMA(data, 20);
    const volumeMA20Series = data
      .map((d, i) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000),
        value: volumeMA20Data[i],
      }))
      .filter((d) => d.value !== null);

    series.volume.setData(volumeData);
    series.volumeMA20.setData(volumeMA20Series);

    // 볼린저 밴드 데이터 설정
    if (series.bb60) {
      const bb60Data = data
        .filter((d) => d.bb60)
        .map((d) => ({
          time: Math.floor(new Date(d.date).getTime() / 1000),
          value: d.bb60.upper, // value 필드 필요
          high: d.bb60.upper,
          low: d.bb60.lower, // value 대신 high와 low 사용
        }));

      series.bb60.area.setData(bb60Data);
      series.bb60.upper.setData(bb60Data);
      series.bb60.lower.setData(
        bb60Data.map((d) => ({ time: d.time, value: d.low }))
      );
    }

    if (series.bb240) {
      const bb240Data = data
        .filter((d) => d.bb240)
        .map((d) => ({
          time: Math.floor(new Date(d.date).getTime() / 1000),
          value: d.bb240.upper, // value 필드 필요
          high: d.bb240.upper,
          low: d.bb240.lower, // value 대신 high와 low 사용
        }));

      series.bb240.area.setData(bb240Data);
      series.bb240.upper.setData(bb240Data);
      series.bb240.lower.setData(
        bb240Data.map((d) => ({ time: d.time, value: d.low }))
      );
    }

    // 차트 동기화 개선
    const syncHandler = (range) => {
      if (!range) return;

      const timeScale1 = chart.timeScale();
      const timeScale2 = volumeChart.timeScale();

      // 동기화 시 서로 다른 차트의 타임스케일 설정
      if (timeScale1 && timeScale2) {
        timeScale1.setVisibleLogicalRange(range);
        timeScale2.setVisibleLogicalRange(range);
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(syncHandler);
    volumeChart.timeScale().subscribeVisibleLogicalRangeChange(syncHandler);

    // 이전 상태 복원
    if (chartStateRef.current) {
      chart.timeScale().setVisibleRange(chartStateRef.current.timeRange);
      // or
      chart
        .timeScale()
        .setVisibleLogicalRange(chartStateRef.current.logicalRange);
    }

    const toolTip = document.createElement('div');
    toolTip.style = `
      position: absolute;
      display: none;
      padding: 8px;
      box-sizing: border-box;
      font-size: 12px;
      text-align: left;
      z-index: 1000;
      top: 12px;
      left: 12px;
      pointer-events: none;
      border: 1px solid;
      border-radius: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: rgba(207, 219, 255, 0.5);
      color: #20262E;
    `;
    containerRef.current.style.position = 'relative';
    containerRef.current.appendChild(toolTip);

    // 날짜 포맷 함수 추가
    const formatDate = (timestamp) => {
      const date = new Date(timestamp * 1000);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // 캔들 차트 툴팁 수정 및 데이터 확인 로깅
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        toolTip.style.display = 'none';
      } else {
        const candleData = param.seriesData.get(series.candle);
        // 마지막 데이터 포인트인 경우에만 추가 지표 표시
        const isLastPoint =
          param.time ===
          Math.floor(new Date(data[data.length - 1].date).getTime() / 1000);

        if (candleData) {
          // 등락률 계산
          const changePercent = (
            ((candleData.close - candleData.open) / candleData.open) *
            100
          ).toFixed(2);
          const sign = changePercent > 0 ? '+' : '';

          // 마지막 캔들에서 추가 지표 데이터 로깅
          if (isLastPoint) {
            console.log('Last candle additional data:', {
              BB240_upper: stock.chart_d_bb240_upper,
              BB240_width: stock.chart_d_bb240_width,
              BB60_upper: stock.chart_d_bb60_upper,
              BB60_width: stock.chart_d_bb60_width,
              sun_width: stock.chart_d_sun_width,
              sun_max: stock.chart_d_sun_max,
              BB상단10: stock.chart_d_bb240_upper10, // 수정
              BB상단20: stock.chart_d_bb240_upper20, // 수정
            });
          }

          toolTip.style.display = 'block';
          toolTip.style.left = `${param.point.x}px`;
          toolTip.style.top = `${param.point.y}px`;
          toolTip.innerHTML = `
            <div>날짜: ${formatDate(param.time)}</div>
            <div>시가: ${candleData.open?.toLocaleString()}</div>
            <div>고가: ${candleData.high?.toLocaleString()}</div>
            <div>저가: ${candleData.low?.toLocaleString()}</div>
            <div>종가: ${candleData.close?.toLocaleString()}</div>
            <div style="color: ${changePercent > 0 ? 'red' : 'blue'}">
              등락률: ${sign}${changePercent}%
            </div>
            ${
              isLastPoint
                ? `
              <div style="margin-top: 4px; border-top: 1px solid #eee; padding-top: 4px;">
                <div>upper240: ${
                  stock.chart_d_bb240_upper?.toFixed(2) || '-'
                }</div>
                <div>width240: ${
                  stock.chart_d_bb240_width?.toFixed(2) || '-'
                }</div>
                <div>upper60: ${
                  stock.chart_d_bb60_upper?.toFixed(2) || '-'
                }</div>
                <div>width60: ${
                  stock.chart_d_bb60_width?.toFixed(2) || '-'
                }</div>
                <div>width_Sun: ${
                  stock.chart_d_sun_width?.toFixed(2) || '-'
                }</div>
                <div>upper_Sun: ${
                  stock.chart_d_sun_max?.toFixed(2) || '-'
                }</div>
                <div>upper_change10: ${
                  stock.chart_d_bb240_upper10?.toFixed(2) || '-'
                }</div>
                <div>upper_change20: ${
                  stock.chart_d_bb240_upper20?.toFixed(2) || '-'
                }</div>
              </div>
            `
                : ''
            }
          `;
        }
      }
    });

    const volumeToolTip = document.createElement('div');
    volumeToolTip.style = `
      position: absolute;
      display: none;
      padding: 8px;
      box-sizing: border-box;
      font-size: 12px;
      text-align: left;
      z-index: 1000;
      top: 12px;
      left: 12px;
      pointer-events: none;
      border: 1px solid;
      border-radius: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: rgba(255, 255, 255, 0.95);
      color: #20262E;
    `;
    volumeContainerRef.current.style.position = 'relative';
    volumeContainerRef.current.appendChild(volumeToolTip);

    // 볼륨 차트 툴팁 수정
    volumeChart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        volumeToolTip.style.display = 'none';
      } else {
        const data = param.seriesData.get(series.volume);
        if (data) {
          volumeToolTip.style.display = 'block';
          volumeToolTip.style.left = `${param.point.x}px`;
          volumeToolTip.style.top = `${param.point.y}px`;
          volumeToolTip.innerHTML = `
            <div>날짜: ${formatDate(param.time)}</div>
            <div>거래량: ${data.value.toLocaleString()}</div>
          `;
        }
      }
    });

    // 시리즈 참조 저장
    seriesRef.current = series;

    return () => {
      // cleanup 전에 현재 상태 저장
      chartStateRef.current = {
        timeRange: chart.timeScale().getVisibleRange(),
        logicalRange: chart.timeScale().getVisibleLogicalRange(),
      };
      chartRef.current = null;
      seriesRef.current = {};
      chart.remove();
      volumeChart.remove();
      if (toolTip) toolTip.remove();
      if (volumeToolTip) volumeToolTip.remove();
    };
  }, [data, options]);

  // createTooltipContent 함수 수정
  const createTooltipContent = (data) => {
    return () => {
      const volume = Number(data.volume).toLocaleString();
      const volRatio = data.vol20
        ? ((data.volume / data.vol20) * 100).toFixed(1)
        : 'N/A';

      return `
        <div style="padding: 8px;">
          <div>날짜: ${data.date.toLocaleDateString()}</div>
          <div>시가: ${data.open?.toLocaleString()}</div>
          <div>고가: ${data.high?.toLocaleString()}</div>
          <div>저가: ${data.low?.toLocaleString()}</div>
          <div>종가: ${data.close?.toLocaleString()}</div>
          <div>거래량: ${volume} (${volRatio}%)</div>
          <div>BB240 상단: ${data.bb240?.upper?.toFixed(2) || 'N/A'}</div>
          <div>BB240 폭: ${data.bb240?.width?.toFixed(2) || 'N/A'}</div>
          <div>BB60 상단: ${data.bb260?.upper?.toFixed(2) || 'N/A'}</div>
          <div>BB60 폭: ${data.bb60?.width?.toFixed(2) || 'N/A'}</div>
          <div>선망 폭: ${data.chart_d_sun_width?.toFixed(2) || 'N/A'}</div>
          <div>선망 최대: ${data.chart_d_sun_max?.toFixed(2) || 'N/A'}</div>
        </div>
      `;
    };
  };

  return (
    <div className="chart-container">
      <div
        ref={containerRef}
        className="price-chart"
        style={{ marginBottom: '0', width: '100%' }}
      />
      <div
        ref={volumeContainerRef}
        className="volume-chart"
        style={{ marginTop: '-1px', width: '100%' }}
      />{' '}
      {/* 항상 표시 */}
    </div>
  );
}

export default StockChart;

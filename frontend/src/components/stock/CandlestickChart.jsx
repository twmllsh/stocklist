import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts'; // CrosshairMode 추가
import { calculateMA, calculateBB } from '../cal/cal';

const CandlestickChart = ({
  data,
  visibleIndicators = {
    ma3: false,
    ma20: true,
    ma60: true,
    ma120: false,
    ma240: false,
    bb60: true,
    bb240: false,
    showDisclosure: true, // 주요공시를 기본값으로 true로 설정
  },
  sharesInfo,
  mainDisclosureData,
  aiOpinionData,
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({
    candle: null,
    volume: null,
    ma: null,
    bbAreas: null,
    bbLines: null,
  });

  // 차트 생성 및 설정
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 컨테이너
    const container = chartContainerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 메인 차트 생성
    const chart = createChart(container, {
      width: width,
      height: height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f3fa' },
        horzLines: { color: '#f0f3fa' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#f0f3fa',
      },
      rightPriceScale: {
        visible: false, // 오른쪽 눈금자 숨김
      },
      leftPriceScale: {
        visible: true, // 왼쪽 눈금자 표시
        borderColor: '#f0f3fa',
        textColor: '#333',
      },
      crosshair: {
        mode: CrosshairMode.Normal, // LightweightCharts 대신 직접 import한 CrosshairMode 사용
      },
      localization: {
        priceFormatter: (price) => formatNumber(price),
        timeFormatter: (time) =>
          new Date(time * 1000).toLocaleString('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }),
      },
    });

    // 캔들스틱과 볼륨 시리즈를 먼저 생성
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ff3737',
      downColor: '#2962FF',
      wickUpColor: '#ff3737',
      wickDownColor: '#2962FF',
      borderVisible: false,
      priceScaleId: 'left', // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
        formatter: (value) => {
          const formatted = Intl.NumberFormat('ko-KR').format(value);
          const actualTotalShares = (sharesInfo?.totalShares || 0) * 1000;
          const actualFloatingShares = (sharesInfo?.floatingShares || 0) * 1000;

          const isOverTotal = actualTotalShares && value > actualTotalShares;
          const isOverFloat =
            actualFloatingShares && value > actualFloatingShares;

          let overflowText = '';
          if (isOverTotal) overflowText = ' [상장 오버]';
          else if (isOverFloat) overflowText = ' [유동 오버]';

          return `${formatted}${overflowText}`;
        },
      },
      priceScaleId: 'volume',
      priceLineVisible: false, // 가격선 숨기기
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 참조 먼저 저장
    seriesRef.current = {
      candle: candlestickSeries,
      volume: volumeSeries,
      ma: null,
      bbAreas: null,
      bbLines: null,
    };

    // 볼린저밴드 영역 시리즈 - areaSeries 대신 baselineSeries 사용
    const bbAreas = {
      240: chart.addBaselineSeries({
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
        // baseline: 중간값을 기준으로 위아래 영역 채우기
        baseValue: { type: 'price', price: 0 },
        // 위쪽 영역 색상
        topLineColor: 'rgba(64, 64, 64, 0.2)',
        topFillColor1: 'rgba(64, 64, 64, 0.1)',
        topFillColor2: 'rgba(64, 64, 64, 0)',
        // 아래쪽 영역 색상
        bottomLineColor: 'rgba(64, 64, 64, 0.2)',
        bottomFillColor1: 'rgba(64, 64, 64, 0.1)',
        bottomFillColor2: 'rgba(64, 64, 64, 0.0)',
      }),
      60: chart.addBaselineSeries({
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
        baseValue: { type: 'price', price: 0 },
        topLineColor: 'rgba(41, 98, 255, 0.2)',
        topFillColor1: 'rgba(41, 98, 255, 0.1)',
        topFillColor2: 'rgba(41, 98, 255, 0.0)',
        bottomLineColor: 'rgba(41, 98, 255, 0.2)',
        bottomFillColor1: 'rgba(41, 98, 255, 0.1)',
        bottomFillColor2: 'rgba(41, 98, 255, 0.0)',
      }),
    };

    // 볼린저밴드 라인 시리즈 생성
    const bbLines = {
      60: {
        upper: chart.addLineSeries({
          priceScaleId: 'left',
          color: 'rgba(41, 98, 255, 0.5)',
          lineWidth: 1,
          title: '',
          visible: true,
          lastValueVisible: false,
          priceLineVisible: false,
          axisLabelVisible: false,
        }),
        lower: chart.addLineSeries({
          priceScaleId: 'left',
          color: 'rgba(41, 98, 255, 0.5)',
          lineWidth: 1,
          title: '',
          visible: true,
          lastValueVisible: false,
          priceLineVisible: false,
          axisLabelVisible: false,
        }),
      },
      240: {
        upper: chart.addLineSeries({
          priceScaleId: 'left',
          color: 'rgba(64, 64, 64, 0.5)',
          lineWidth: 1,
          title: '',
          visible: true,
          lastValueVisible: false,
          priceLineVisible: false,
          axisLabelVisible: false,
        }),
        lower: chart.addLineSeries({
          priceScaleId: 'left',
          color: 'rgba(233, 30, 99, 0.5)',
          lineWidth: 1,
          title: '',
          visible: true,
          lastValueVisible: false,
          priceLineVisible: false,
          axisLabelVisible: false,
        }),
      },
    };

    // 이동평균선 시리즈 수정
    const maLines = {
      3: chart.addLineSeries({
        color: 'black',
        lineWidth: 1,
        lineStyle: 0, // 0: 실선, 1: 점선, 2: 대쉬
        title: '',
        lastValueVisible: false, // 마지막 값 레이블 숨기기
        priceLineVisible: false, // 가격선 숨기기
        axisLabelVisible: false, // y축 레이블 숨기기
      }),
      20: chart.addLineSeries({
        color: 'red',
        lineWidth: 2,
        lineStyle: 0, // 0: 실선, 1: 점선, 2: 대쉬
        title: '',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
      }),
      60: chart.addLineSeries({
        color: 'blue',
        lineWidth: 2,
        lineStyle: 0, // 0: 실선, 1: 점선, 2: 대쉬
        title: '',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
      }),
      120: chart.addLineSeries({
        color: 'green',
        lineWidth: 3,
        lineStyle: 0, // 0: 실선, 1: 점선, 2: 대쉬
        title: '',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
      }),
      240: chart.addLineSeries({
        color: '#999a9e',
        lineWidth: 3,
        lineStyle: 0, // 0: 실선, 1: 점선, 2: 대쉬
        title: '',
        lastValueVisible: false,
        priceLineVisible: false,
        axisLabelVisible: false,
      }),
    };

    // 시리즈 참조 업데이트
    seriesRef.current.ma = maLines;
    seriesRef.current.bbAreas = bbAreas;
    seriesRef.current.bbLines = bbLines;

    // 툴팁 설정
    const tooltipEl = document.createElement('div');
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.display = 'none';
    tooltipEl.style.backgroundColor = 'white';
    tooltipEl.style.padding = '8px';
    tooltipEl.style.border = '1px solid #2962FF';
    tooltipEl.style.borderRadius = '4px';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.color = '#333';
    tooltipEl.style.zIndex = '9999';
    tooltipEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    container.style.position = 'relative';
    container.appendChild(tooltipEl);

    const handleMouseLeave = () => {
      tooltipEl.style.display = 'none';
    };

    const handleCrosshairMove = (param) => {
      if (!param.point || !param.time) {
        tooltipEl.style.display = 'none';
        return;
      }

      // 시리즈 데이터 null 체크 추가
      if (!param.seriesData || !param.seriesData.size) {
        tooltipEl.style.display = 'none';
        return;
      }

      // candlestickSeries 직접 참조 대신 현재 시리즈 참조 사용
      const candleData = param.seriesData.get(candlestickSeries);
      const volumeData = param.seriesData.get(volumeSeries);

      if (!candleData) {
        tooltipEl.style.display = 'none';
        return;
      }

      const { x, y } = param.point;

      // 툴팁 표시 및 내용 업데이트
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${x + 15}px`;
      tooltipEl.style.top = `${y - 15}px`;

      const date = new Date(param.time * 1000).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const color = candleData.close >= candleData.open ? '#ff3737' : '#2962FF';

      tooltipEl.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${date}</div>
        <div style="color: ${color}">
          <div>시가: ${formatNumber(candleData.open)}</div>
          <div>고가: ${formatNumber(candleData.high)}</div>
          <div>저가: ${formatNumber(candleData.low)}</div>
          <div>종가: ${formatNumber(candleData.close)}</div>
          ${
            volumeData
              ? `<div style="color: #666">거래량: ${formatNumber(
                  volumeData.value
                )}</div>`
              : ''
          }
        </div>
      `;
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    chartRef.current = chart;

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mouseleave', handleMouseLeave);
      tooltipEl.remove();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [sharesInfo]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current.candle || !data?.length) return;

    try {
      const candleData = data.map((item) => ({
        time: item.time,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }));

      let allMarkers = [];

      // AI 의견 마커 추가 로직 수정
      if (visibleIndicators.showAiOpinion && aiOpinionData) {
        const opinions = Array.isArray(aiOpinionData[0])
          ? aiOpinionData[0]
          : aiOpinionData;

        opinions.forEach((opinion) => {
          const opinionDate = new Date(opinion.created_at);
          opinionDate.setHours(9, 0, 0, 0);

          const targetCandle = data.find((candle) => {
            const candleDate = new Date(candle.time * 1000);
            return candleDate.getTime() === opinionDate.getTime();
          });

          if (targetCandle) {
            const priceRange = targetCandle.high - targetCandle.low;
            const offset = priceRange * 0.01;

            const markerConfig = {
              time: targetCandle.time,
              position: 'inBar', // inBar로 변경하여 항상 표시되도록
              size: 1.2,
            };

            // 매수/매도/보류에 따른 설정
            switch (opinion.opinion) {
              case '매수':
                markerConfig.color = '#ff4444';
                markerConfig.shape = 'arrowUp';
                markerConfig.position = 'belowBar';
                markerConfig.price = targetCandle.low - offset;
                break;
              case '매도':
                markerConfig.color = '#2962FF';
                markerConfig.shape = 'arrowDown';
                markerConfig.position = 'aboveBar';
                markerConfig.price = targetCandle.high + offset;
                break;
              default:
                markerConfig.color = '#FFB74D';
                markerConfig.shape = 'circle';
                markerConfig.position = 'aboveBar';
                markerConfig.price = targetCandle.high + offset;
                break;
            }

            allMarkers.push(markerConfig);
          }
        });
      }

      // 주요공시 마커 추가 수정
      if (visibleIndicators.showDisclosure && mainDisclosureData?.length > 0) {
        mainDisclosureData.forEach((item) => {
          const timestamp = Math.floor(new Date(item.날짜).getTime() / 1000);
          const targetCandle = data.find((candle) => candle.time === timestamp);

          if (targetCandle) {
            const priceRange = targetCandle.high - targetCandle.low;
            allMarkers.push({
              time: timestamp,
              position: 'aboveBar',
              color: getBadgeColor(item.카테고리),
              shape: 'square',
              text: item.카테고리.slice(0, 2),
              size: 1,
              price: targetCandle.high + priceRange * 0.02, // 캔들 높이의 2% 위에 표시
            });
          }
        });
      }

      // 마커 설정 업데이트 (프레임 처리 개선)
      seriesRef.current.candle.setData(candleData);
      if (allMarkers.length > 0) {
        // 마커 설정 지연
        requestAnimationFrame(() => {
          seriesRef.current.candle.setMarkers([]);
          requestAnimationFrame(() => {
            seriesRef.current.candle.setMarkers(allMarkers);
          });
        });
      }

      const volumeData = data.map((item) => ({
        time: item.time,
        value: Number(item.volume),
        color: Number(item.close) >= Number(item.open) ? '#ff3737' : '#2962FF',
      }));

      seriesRef.current.volume.setData(volumeData);

      // 이동평균선 데이터 계산 및 설정
      [3, 20, 60, 120, 240].forEach((period) => {
        const maData = calculateMA(data, period);
        const maLineData = maData
          .map((ma, i) => (ma ? { time: data[i].time, value: ma } : null))
          .filter((item) => item !== null);

        seriesRef.current.ma[period].setData(maLineData);
      });

      // 볼린저밴드 데이터 설정
      [60, 240].forEach((period) => {
        const bbData = calculateBB(data, period);
        const areaData = [];
        const upperData = [];
        const lowerData = [];

        bbData.forEach((bb, i) => {
          if (!bb) return;
          const time = data[i].time;

          // baseline 시리즈용 데이터 포맷
          // value: 실제 값, baseline: 중간값 기준
          areaData.push({
            time,
            value: bb.upper, // 상단 밴드
            baseline: bb.middle, // 중간값
          });
          areaData.push({
            time,
            value: bb.lower, // 하단 밴드
            baseline: bb.middle, // 중간값
          });

          // 상하단 라인용 데이터
          upperData.push({ time, value: bb.upper });
          lowerData.push({ time, value: bb.lower });
        });

        // 영역 데이터 설정 (채우기)
        seriesRef.current.bbAreas[period].setData(areaData);

        // 라인 데이터 설정
        seriesRef.current.bbLines[period].upper.setData(upperData);
        seriesRef.current.bbLines[period].lower.setData(lowerData);
      });

      // 초기 뷰포트 설정 수정
      if (candleData.length > 0) {
        const timeScale = chartRef.current.timeScale();
        const lastIndex = candleData.length - 1;
        const startIndex = Math.max(0, lastIndex - 180); // 마지막 200개 데이터

        // 한 캔들의 너비 계산
        const candleWidth =
          candleData[lastIndex].time - candleData[lastIndex - 1].time;

        const visibleRange = {
          from: candleData[startIndex].time - candleWidth * 5, // 왼쪽으로 5개 캔들만큼 이동
          to: candleData[lastIndex].time + candleWidth * 5, // 오른쪽 여백 5개
        };

        // 차트 업데이트 및 범위 설정
        timeScale.fitContent();
        requestAnimationFrame(() => {
          timeScale.setVisibleRange(visibleRange);
          // 오른쪽으로 스크롤
          const barSpace = timeScale.scrollPosition();
          timeScale.scrollToPosition(barSpace + 15, false); // 오른쪽으로 5단위 이동
        });
      }

      // 차트 설정 업데이트 - 마커가 잘 보이도록 여백 조정
      chartRef.current.applyOptions({
        rightPriceScale: {
          scaleMargins: {
            top: 0.1, // 위쪽 여백
            bottom: 0.1, // 아래쪽 여백
          },
        },
        leftPriceScale: {
          autoScale: true,
          scaleMargins: {
            top: 0.2, // 위쪽 여백 20%
            bottom: 0.1, // 아래쪽 여백 10%
          },
          entireTextOnly: true,
        },
      });
    } catch (error) {
      console.error('차트 데이터 업데이트 에러:', error);
    }
  }, [
    data,
    visibleIndicators.showDisclosure,
    visibleIndicators.showAiOpinion,
    mainDisclosureData,
    aiOpinionData,
  ]);

  // 지표 표시 여부 업데이트
  useEffect(() => {
    if (
      !seriesRef.current.ma ||
      !seriesRef.current.bbLines ||
      !seriesRef.current.bbAreas
    )
      return;

    // MA 라인 표시/숨김 설정
    Object.entries(seriesRef.current.ma).forEach(([period, series]) => {
      series.applyOptions({
        visible: visibleIndicators[`ma${period}`],
      });
    });

    // BB 라인과 영역 표시/숨김 설정
    [60, 240].forEach((period) => {
      const isVisible = visibleIndicators[`bb${period}`];
      seriesRef.current.bbAreas[period]?.applyOptions({ visible: isVisible });
      seriesRef.current.bbLines[period]?.upper.applyOptions({
        visible: isVisible,
      });
      seriesRef.current.bbLines[period]?.lower.applyOptions({
        visible: isVisible,
      });
    });
  }, [visibleIndicators]);

  // 주요공시와 AI의견 마커 추가 (수정된 부분)
  useEffect(() => {
    if (!seriesRef.current.candle) return;

    let allMarkers = [];

    // 주요공시 마커 추가 (디버깅 로그 추가)
    if (visibleIndicators.showDisclosure && mainDisclosureData?.length > 0) {
      console.log('주요공시 데이터:', mainDisclosureData);

      mainDisclosureData.forEach((disclosure) => {
        const disclosureDate = new Date(disclosure.날짜);
        disclosureDate.setHours(9, 0, 0, 0); // 시간을 09:00:00으로 설정
        const timestamp = Math.floor(disclosureDate.getTime() / 1000);

        console.log('공시 처리:', {
          date: disclosure.날짜,
          timestamp,
          category: disclosure.카테고리,
        });

        // 해당 날짜의 캔들 찾기
        const targetCandle = data.find((candle) => {
          const candleDate = new Date(candle.time * 1000);
          candleDate.setHours(9, 0, 0, 0);
          return candleDate.getTime() === disclosureDate.getTime();
        });

        if (targetCandle) {
          console.log('매칭된 캔들:', targetCandle);
          const priceRange = targetCandle.high - targetCandle.low;
          allMarkers.push({
            time: timestamp,
            position: 'aboveBar',
            color: getBadgeColor(disclosure.카테고리),
            shape: 'square',
            text: disclosure.카테고리.slice(0, 2),
            size: 1,
            price: targetCandle.high + priceRange * 0.02,
          });
        }
      });

      console.log('생성된 주요공시 마커:', allMarkers);
    }

    // AI 의견 마커 추가 (기존 코드 유지)
    if (visibleIndicators.showAiOpinion && aiOpinionData?.length > 0) {
      aiOpinionData.forEach((opinion) => {
        const timestamp = Math.floor(
          new Date(opinion.created_at).getTime() / 1000
        );
        const targetCandle = data.find((candle) => candle.time === timestamp);

        if (targetCandle) {
          const priceRange = targetCandle.high - targetCandle.low;
          const offset = priceRange * 0.01;

          const markerConfig = {
            time: timestamp,
            position: opinion.opinion === '매수' ? 'belowBar' : 'aboveBar',
            color: opinion.opinion === '매수' ? '#FF5722' : '#2962FF',
            shape: opinion.opinion === '매수' ? 'arrowUp' : 'arrowDown',
            text: opinion.opinion,
            size: 1,
            price:
              opinion.opinion === '매수'
                ? targetCandle.low - offset
                : targetCandle.high + offset,
          };

          allMarkers.push(markerConfig);
        }
      });
    }

    // 마커 업데이트 전에 로깅
    console.log('최종 마커 설정:', allMarkers);

    // 마커 업데이트
    seriesRef.current.candle.setMarkers(allMarkers);
  }, [
    visibleIndicators.showDisclosure,
    visibleIndicators.showAiOpinion,
    mainDisclosureData,
    aiOpinionData,
    data,
  ]);

  // 마우스오버 툴팁 업데이트
  useEffect(() => {
    if (!chartRef.current) return;

    const tooltipHandler = (param) => {
      if (!param.time) return;

      const timestamp = param.time * 1000;
      let tooltipText = [];

      // 주요공시 툴팁
      if (visibleIndicators.showDisclosure) {
        const disclosure = mainDisclosureData?.find(
          (d) =>
            Math.abs(new Date(d.날짜).getTime() - timestamp) <
            24 * 60 * 60 * 1000
        );
        if (disclosure) {
          tooltipText.push(
            `공시: ${disclosure.카테고리}`,
            `내용: ${disclosure.대략적인_내용}`
          );
        }
      }

      // AI의견 툴팁
      if (visibleIndicators.showAiOpinion) {
        const opinion = aiOpinionData?.find(
          (o) =>
            Math.abs(new Date(o.created_at).getTime() - timestamp) <
            24 * 60 * 60 * 1000
        );
        if (opinion) {
          tooltipText.push(
            `AI의견: ${opinion.opinion}`,
            `분석: ${opinion.reason.slice(0, 50)}...`
          );
        }
      }

      return tooltipText.join('\n');
    };

    chartRef.current.subscribeCrosshairMove((param) => {
      const tooltipText = tooltipHandler(param);
      // 툴팁 표시 로직...
    });
  }, [
    visibleIndicators.showDisclosure,
    visibleIndicators.showAiOpinion,
    mainDisclosureData,
    aiOpinionData,
  ]);

  // 카테고리별 색상 지정
  const getBadgeColor = (category) => {
    switch (category) {
      case '계약':
        return '#198754';
      case '3자배정유증':
        return '#0d6efd';
      case '전환사채':
        return '#ffc107';
      case '무상증자':
        return '#0dcaf0';
      default:
        return '#6c757d';
    }
  };

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
  );
};

// 숫자 포맷팅 함수
const formatNumber = (num) => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

export default CandlestickChart;

useEffect(() => {
  if (!seriesRef.current.candle || !data?.length) return;

  let allMarkers = [];

  // 주요공시 마커 추가
  if (visibleIndicators.showDisclosure && mainDisclosureData?.length > 0) {
    mainDisclosureData.forEach((disclosure) => {
      const disclosureDate = new Date(disclosure.날짜);
      disclosureDate.setHours(9, 0, 0, 0);
      const timestamp = Math.floor(disclosureDate.getTime() / 1000);

      const targetCandle = data.find((candle) => {
        const candleDate = new Date(candle.time * 1000);
        candleDate.setHours(9, 0, 0, 0);
        return candleDate.getTime() === disclosureDate.getTime();
      });

      if (targetCandle) {
        const priceRange = targetCandle.high - targetCandle.low;
        allMarkers.push({
          time: timestamp,
          position: 'aboveBar',
          color: getBadgeColor(disclosure.카테고리),
          shape: 'square',
          text: disclosure.카테고리.slice(0, 2),
          size: 1,
          price: targetCandle.high + priceRange * 0.04, // 주요공시 마커를 AI 의견보다 위에 표시
        });
      }
    });
  }

  // AI 의견 마커 추가
  if (visibleIndicators.showAiOpinion && aiOpinionData?.length > 0) {
    const opinions = Array.isArray(aiOpinionData)
      ? aiOpinionData
      : [aiOpinionData];

    opinions.forEach((opinion) => {
      const opinionDate = new Date(opinion.created_at);
      opinionDate.setHours(9, 0, 0, 0);

      const targetCandle = data.find((candle) => {
        const candleDate = new Date(candle.time * 1000);
        candleDate.setHours(9, 0, 0, 0);
        return candleDate.getTime() === opinionDate.getTime();
      });

      if (targetCandle) {
        const priceRange = targetCandle.high - targetCandle.low;
        const markerConfig = {
          time: targetCandle.time,
          size: 1.2,
        };

        switch (opinion.opinion) {
          case '매수':
            markerConfig.color = '#ff4444';
            markerConfig.shape = 'arrowUp';
            markerConfig.position = 'belowBar';
            markerConfig.price = targetCandle.low - priceRange * 0.02;
            break;
          case '매도':
            markerConfig.color = '#2962FF';
            markerConfig.shape = 'arrowDown';
            markerConfig.position = 'aboveBar';
            markerConfig.price = targetCandle.high + priceRange * 0.02;
            break;
          default:
            markerConfig.color = '#FFB74D';
            markerConfig.shape = 'circle';
            markerConfig.position = 'aboveBar';
            markerConfig.price = targetCandle.high + priceRange * 0.02;
        }

        allMarkers.push(markerConfig);
      }
    });
  }

  // 마커 설정 - 리렌더링 최적화
  if (
    JSON.stringify(seriesRef.current.candle.markers) !==
    JSON.stringify(allMarkers)
  ) {
    seriesRef.current.candle.setMarkers(allMarkers);
  }
}, [
  data,
  visibleIndicators.showDisclosure,
  visibleIndicators.showAiOpinion,
  mainDisclosureData,
  aiOpinionData,
]);

import React, { useState, useEffect, useMemo } from 'react';
import { Alert, Spinner, Card, Table, Row, Col } from 'react-bootstrap';
import { stockService } from '../../../services/stockService';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../store/slices/authSlice';
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
  Filler, // Filler 플러그인 import 추가
} from 'chart.js';

// Chart.js 컴포넌트 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // Filler 플러그인 등록 추가
);

// ChartModal에서 activeTab prop을 받도록 수정
const StockLoanShort = ({ stockCode, ohlcvData, activeTab = 'loanShort' }) => {
  const user = useSelector(selectUser);
  const [loanData, setLoanData] = useState(null);
  const [shortData, setShortData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 거래량 20일 이동평균 계산 - 디버깅 로그 개선
  const volumeMA20Data = useMemo(() => {
    // 조건을 세분화하여 더 정확한 로깅 제공
    if (!ohlcvData) {
      // 실제 문제가 발생한 경우만 콘솔에 출력 (탭 전환 시 초기 렌더링일 가능성)
      if (stockCode && activeTab === 'loanShort') {
        console.log(
          `종목코드 ${stockCode}의 OHLCV 데이터가 전달되지 않았습니다.`
        );
      }
      return null;
    }

    if (!Array.isArray(ohlcvData)) {
      console.error(`OHLCV 데이터가 배열 형태가 아닙니다:`, typeof ohlcvData);
      return null;
    }

    if (ohlcvData.length === 0) {
      console.log(`OHLCV 데이터 배열이 비어 있습니다.`);
      return null;
    }

    // 볼륨 데이터 필드 확인 및 추출
    let volumeFieldName = null;
    if ('volume' in ohlcvData[0]) {
      volumeFieldName = 'volume';
    } else if ('Volume' in ohlcvData[0]) {
      volumeFieldName = 'Volume';
    } else {
      console.error('볼륨 필드를 찾을 수 없습니다:', Object.keys(ohlcvData[0]));
      return null;
    }

    // console.log('사용할 볼륨 필드명:', volumeFieldName);

    // 거래량 데이터 추출 (필드명 동적 감지)
    const volumeData = ohlcvData.map((item) => {
      // 날짜 필드 추출 (time 또는 date 또는 Date 필드명)
      let dateValue;
      if ('time' in item) {
        // Unix 타임스탬프를 Date 객체로 변환
        dateValue = new Date(item.time * 1000);
      } else if ('date' in item) {
        dateValue = new Date(item.date);
      } else if ('Date' in item) {
        dateValue = new Date(item.Date);
      } else {
        console.error('날짜 필드를 찾을 수 없습니다:', Object.keys(item));
        dateValue = new Date(); // 기본값
      }

      const dateStr = dateValue.toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 표준화

      // 볼륨 값 추출 및 유효성 확인
      const volumeValue = Number(item[volumeFieldName] || 0);

      if (isNaN(volumeValue)) {
        console.warn(
          `유효하지 않은 볼륨 값 (${dateStr}):`,
          item[volumeFieldName]
        );
      }

      return {
        date: dateStr,
        volume: volumeValue,
      };
    });

    // 볼륨 데이터 샘플 로깅
    // console.log('추출된 거래량 데이터 처음 5개:', volumeData.slice(0, 5));
    // console.log('추출된 거래량 데이터 마지막 5개:', volumeData.slice(-5));

    // 최소/최대 거래량 확인
    const volumes = volumeData
      .map((item) => item.volume)
      .filter((v) => !isNaN(v) && v !== null);
    // console.log('거래량 최소값:', Math.min(...volumes));
    // console.log('거래량 최대값:', Math.max(...volumes));
    // console.log(
    //   '거래량 평균값:',
    //   volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    // );

    // 날짜순으로 정렬
    volumeData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 20일 이동평균 계산 (이전 코드와 동일)
    const ma20 = [];
    for (let i = 0; i < volumeData.length; i++) {
      if (i < 19) {
        ma20.push({ date: volumeData[i].date, ma20: null });
      } else {
        // 20일 동안의 거래량 합계 계산
        let sum = 0;
        let count = 0;
        for (let j = i - 19; j <= i; j++) {
          // 유효한 거래량 값만 합산
          if (!isNaN(volumeData[j].volume) && volumeData[j].volume !== null) {
            sum += volumeData[j].volume;
            count++;
          }
        }
        // 유효한 데이터가 있는 경우만 평균 계산하고 정수로 변환
        const avgValue = count > 0 ? Math.round(sum / count) : null;
        ma20.push({
          date: volumeData[i].date,
          ma20: avgValue,
        });
      }
    }

    // 계산된 MA20 값 로깅
    const validMA20 = ma20.filter((item) => item.ma20 !== null);
    // console.log('20일 평균 거래량 처음 5개:', validMA20.slice(0, 5));
    // console.log('20일 평균 거래량 마지막 5개:', validMA20.slice(-5));

    if (validMA20.length > 0) {
      //   console.log(
      //     '20일 평균 거래량 최소값:',
      //     Math.min(...validMA20.map((item) => item.ma20))
      //   );
      //   console.log(
      //     '20일 평균 거래량 최대값:',
      //     Math.max(...validMA20.map((item) => item.ma20))
      //   );
    }

    return ma20;
  }, [ohlcvData, stockCode, activeTab]); // activeTab 의존성 추가

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // console.log('===== 대차정보/공매도 데이터 요청 시작 =====');
        // console.log('종목코드:', stockCode);

        // 대차정보 요청
        // console.log(
        //   '대차정보 요청 URL:',
        //   `/shortinterest/?ticker=${stockCode}`
        // );
        const loanResponse = await stockService.getStockShortInterest(
          stockCode
        );
        // console.log('대차정보 응답 데이터:', loanResponse);

        // 공매도 요청
        // console.log('공매도 요청 URL:', `/short/?ticker=${stockCode}`);
        const shortResponse = await stockService.getStockShort(stockCode);
        // console.log('공매도 응답 데이터:', shortResponse);

        if (loanResponse && shortResponse) {
          // 날짜 순서대로 정렬 (과거 날짜가 앞으로)
          const sortedLoanData = Array.isArray(loanResponse)
            ? [...loanResponse].sort(
                (a, b) => new Date(a.Date) - new Date(b.Date)
              )
            : loanResponse;

          const sortedShortData = Array.isArray(shortResponse)
            ? [...shortResponse].sort(
                (a, b) => new Date(a.Date) - new Date(b.Date)
              )
            : shortResponse;

          //   console.log('정렬된 대차정보 데이터:', sortedLoanData);
          //   console.log('정렬된 공매도 데이터:', sortedShortData);

          setLoanData(sortedLoanData);
          setShortData(sortedShortData);
        } else {
          //   console.log(
          //     '데이터 없음 - loanResponse:',
          //     !!loanResponse,
          //     'shortResponse:',
          //     !!shortResponse
          //   );
          setError('대차정보/공매도 데이터가 없습니다.');
        }
      } catch (err) {
        console.error('대차정보/공매도 데이터 요청 에러:', err);
        setError('대차정보/공매도 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (stockCode) {
      fetchData();
    }
  }, [stockCode]);

  // 회원 등급 체크
  if (user?.membership === 'ASSOCIATE') {
    return (
      <Alert variant="warning">
        이 기능은 정회원 이상만 이용할 수 있습니다.
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-5">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <div className="text-primary">데이터 로딩중...</div>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!loanData && !shortData) {
    return <Alert variant="info">대차정보/공매도 데이터가 없습니다.</Alert>;
  }

  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '-';
  };

  // 통합 차트 데이터 준비
  const prepareChartData = () => {
    // console.log('차트 데이터 준비 시작');
    // console.log('loanData:', loanData);
    // console.log('shortData:', shortData);
    // console.log('volumeMA20Data:', volumeMA20Data);

    if (
      !loanData ||
      !shortData ||
      !Array.isArray(loanData) ||
      !Array.isArray(shortData) ||
      loanData.length === 0 ||
      shortData.length === 0
    ) {
      //   console.log('차트 데이터가 없거나 유효하지 않습니다.');
      return null;
    }

    // 날짜 매칭을 위해 대차정보/공매도 데이터의 날짜 형식 변환 함수
    const standardizeDate = (dateStr) => {
      // 다양한 날짜 형식을 처리
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
      } catch (e) {
        console.error('날짜 형식 변환 에러:', dateStr, e);
        return null;
      }
    };

    // 해당 날짜의 데이터 찾기 함수
    const findLoanData = (date) => {
      // date는 이미 표준화된 YYYY-MM-DD 형식
      return loanData.find((item) => standardizeDate(item.Date) === date);
    };

    const findShortData = (date) => {
      return shortData.find((item) => standardizeDate(item.Date) === date);
    };

    const findVolumeMA20 = (date) => {
      // date는 이미 표준화된 YYYY-MM-DD 형식
      return volumeMA20Data?.find((item) => item.date === date)?.ma20 || null;
    };

    // 날짜 범위 찾기 - 모든 날짜 표준화하여 비교
    const allDatesSet = new Set(
      [
        ...loanData.map((item) => standardizeDate(item.Date)),
        ...shortData.map((item) => standardizeDate(item.Date)),
      ].filter(Boolean)
    ); // null/undefined 제외

    const allDates = Array.from(allDatesSet).sort();
    // console.log('표준화된 모든 날짜:', allDates);

    // 최근 30일 데이터만 사용
    const recentDates = allDates.slice(-30);
    // console.log('최근 30일 날짜:', recentDates);

    // 각 날짜별로 데이터가 있는지 미리 확인
    const validDates = recentDates.filter((date) => {
      const hasLoanData = findLoanData(date) !== undefined;
      const hasShortData = findShortData(date) !== undefined;
      return hasLoanData || hasShortData;
    });
    // console.log('유효한 날짜 데이터:', validDates);

    // 대차정보 날짜만 추출하여 Set으로 생성 (빠른 검색을 위해)
    const loanDatesSet = new Set(
      loanData.map((item) => standardizeDate(item.Date)).filter(Boolean)
    );

    // 모바일 감지
    const isMobile = window.innerWidth < 768;

    // 메인 차트 데이터셋 - 비교를 위해 모두 포함
    const mainChartDatasets = [
      {
        label: '대차잔여주식수',
        data: validDates.map((date) => {
          const item = findLoanData(date);
          return item ? item.대차잔여주식수 : null;
        }),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y',
        tension: 0.1,
        pointRadius: isMobile ? 1.5 : 3, // 모바일에서는 더 작은 포인트
        borderWidth: isMobile ? 1.5 : 2, // 모바일에서는 더 얇은 선
        fill: false, // 영역 채우기 비활성화
        spanGaps: true, // 데이터 갭 연결
      },
      {
        label: '공매도',
        data: validDates.map((date) => {
          const item = findShortData(date);
          return item ? item.공매도 : null;
        }),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'y',
        tension: 0.1,
        pointRadius: isMobile ? 1.5 : 3,
        borderWidth: isMobile ? 1.5 : 2,
        fill: false,
        spanGaps: true,
      },
      {
        label: '매수',
        data: validDates.map((date) => {
          const item = findShortData(date);
          return item ? item.매수 : null;
        }),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y',
        tension: 0.1,
        pointRadius: isMobile ? 1.5 : 3,
        borderWidth: isMobile ? 1.5 : 2,
        fill: false,
        spanGaps: true,
      },
      {
        label: '거래량 20일 이동평균',
        data: validDates.map((date) => {
          if (loanDatesSet.has(date)) {
            const value = findVolumeMA20(date);
            // 정수로 변환
            return value !== null ? Math.round(value) : null;
          }
          return null;
        }),
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        yAxisID: 'y', // 동일한 Y축 사용으로 변경 (y1에서 y로)
        tension: 0.1,
        pointRadius: isMobile ? 0 : 2, // 모바일에서는 포인트 숨김
        borderWidth: isMobile ? 1 : 1.5,
        borderDash: [5, 5], // 점선으로 표시
        fill: false,
        spanGaps: true,
      },
    ];

    // 개별 차트용 데이터셋 준비 함수 수정
    const prepareIndividualChartData = (label, data, color) => {
      // 유효한 데이터 포인트만 필터링하여 최소/최대값 계산
      const validData = data.filter(
        (value) => value !== null && value !== undefined
      );
      const minValue = validData.length ? Math.min(...validData) : 0;
      const maxValue = validData.length ? Math.max(...validData) : 100;

      // 버퍼 추가 (데이터 범위의 10%)
      const buffer = (maxValue - minValue) * 0.1;
      const yMin = Math.max(0, minValue - buffer); // 0보다 작아지지 않도록
      const yMax = maxValue + buffer;

      return {
        labels: validDates,
        datasets: [
          {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.2)'),
            tension: 0.1,
            pointRadius: window.innerWidth < 768 ? 0 : 2, // 모바일에서는 점 숨김
            fill: true,
            spanGaps: true, // 데이터 간격 연결
          },
        ],
        // 차트별 권장 Y축 범위 추가
        yRange: {
          min: yMin,
          max: yMax,
          suggestedMin: yMin,
          suggestedMax: yMax,
        },
      };
    };

    // 대차잔여주식수 개별 데이터
    const loanBalanceData = validDates.map((date) => {
      const item = findLoanData(date);
      return item ? item.대차잔여주식수 : null;
    });

    // 공매도 개별 데이터
    const shortVolumeData = validDates.map((date) => {
      const item = findShortData(date);
      return item ? item.공매도 : null;
    });

    // 매수 개별 데이터
    const buyVolumeData = validDates.map((date) => {
      const item = findShortData(date);
      return item ? item.매수 : null;
    });

    // 거래량 MA20 개별 데이터
    const volumeMA20Values = validDates.map((date) => {
      if (loanDatesSet.has(date)) {
        const value = findVolumeMA20(date);
        return value !== null ? Math.round(value) : null; // 정수로 변환
      }
      return null;
    });

    // 공매도 비중 개별 데이터 추가
    const shortRatioData = validDates.map((date) => {
      const item = findShortData(date);
      return item ? item.비중 : null;
    });

    // 개별 차트 데이터셋
    const loanBalanceChartData = prepareIndividualChartData(
      '대차잔여주식수',
      loanBalanceData,
      'rgba(255, 99, 132, 1)'
    );

    const shortVolumeChartData = prepareIndividualChartData(
      '공매도',
      shortVolumeData,
      'rgba(54, 162, 235, 1)'
    );

    const buyVolumeChartData = prepareIndividualChartData(
      '매수',
      buyVolumeData,
      'rgba(75, 192, 192, 1)'
    );

    const volumeMA20ChartData = prepareIndividualChartData(
      '거래량 20일 이동평균',
      volumeMA20Values,
      'rgba(153, 102, 255, 1)'
    );

    // 공매도 비중 차트 데이터 추가
    const shortRatioChartData = prepareIndividualChartData(
      '공매도 비중(%)',
      shortRatioData,
      'rgba(255, 159, 64, 1)' // 주황색 계열
    );

    return {
      main: {
        labels: validDates,
        datasets: mainChartDatasets,
      },
      loanBalance: loanBalanceChartData,
      shortVolume: shortVolumeChartData,
      buyVolume: buyVolumeChartData,
      volumeMA20: volumeMA20ChartData,
      shortRatio: shortRatioChartData, // 공매도 비중 차트 데이터 추가
    };
  };

  // 메인 차트 옵션
  const mainChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: '대차/공매도 추이(전체)',
        font: {
          size: window.innerWidth < 768 ? 13 : 16,
          weight: 'bold',
        },
        padding: { top: 5, bottom: 5 }, // 타이틀 패딩 축소
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              // 모든 값을 정수로 표시
              const displayValue = Math.round(
                context.parsed.y
              ).toLocaleString();
              label += displayValue + '주';
            }
            return label;
          },
        },
        titleFont: {
          size: window.innerWidth < 768 ? 10 : 12,
        },
        bodyFont: {
          size: window.innerWidth < 768 ? 10 : 12,
        },
        boxPadding: window.innerWidth < 768 ? 3 : 6,
      },
      legend: {
        position: window.innerWidth < 768 ? 'bottom' : 'top',
        align: 'start',
        labels: {
          boxWidth: window.innerWidth < 768 ? 8 : 10,
          padding: window.innerWidth < 768 ? 5 : 10,
          font: {
            size: window.innerWidth < 768 ? 9 : 11,
          },
          usePointStyle: true,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: window.innerWidth >= 768, // 모바일에서는 X축 제목 숨김
          text: '날짜',
        },
        ticks: {
          maxRotation: 90, // 모바일에서 레이블이 겹치지 않도록 회전
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
          font: {
            size: window.innerWidth < 768 ? 7 : 10,
          },
        },
        grid: {
          display: false,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: window.innerWidth >= 768,
          text: '주식수',
          font: {
            size: window.innerWidth < 768 ? 10 : 12,
          },
        },
        min: 0,
        ticks: {
          callback: function (value) {
            // 모바일에서는 더 간단한 형식으로 표시
            if (window.innerWidth < 768) {
              if (value >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
              }
              return value;
            }
            return Math.round(value).toLocaleString();
          },
          font: {
            size: window.innerWidth < 768 ? 9 : 11,
          },
          maxTicksLimit: window.innerWidth < 768 ? 5 : 8, // 모바일에서 더 적은 Y축 틱
          padding: 0, // 패딩 제거
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.03)', // 그리드 선 색상 연하게
        },
        border: {
          display: false,
        },
      },
    },
    layout: {
      padding: 0, // 전체 패딩 제거
    },
  };

  // 개별 차트 공통 옵션 - 모바일 최적화 개선
  const individualChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toLocaleString() + '주';
            }
            return label;
          },
          // 툴팁에 날짜 포맷팅 추가
          title: function (context) {
            const title = context[0].label;
            if (!title) return '';

            // 날짜 포맷팅
            try {
              const date = new Date(title);
              return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              });
            } catch (e) {
              return title;
            }
          },
        },
        titleFont: {
          size: window.innerWidth < 768 ? 10 : 12,
        },
        bodyFont: {
          size: window.innerWidth < 768 ? 10 : 12,
        },
      },
    },
    layout: {
      padding: 0, // 패딩 완전 제거
    },
    scales: {
      x: {
        display: true,
        ticks: {
          display: true,
          autoSkip: true,
          maxTicksLimit: window.innerWidth < 768 ? 3 : 6, // 모바일에서 더 적은 틱
          maxRotation: 0, // 레이블 회전 없애기
          minRotation: 0,
          font: {
            size: window.innerWidth < 768 ? 8 : 10, // 폰트 크기 더 작게
          },
          callback: function (value, index, ticks) {
            if (window.innerWidth < 768 && index % 2 !== 0) return ''; // 모바일에서는 레이블 간격 2배로

            // 날짜 포맷팅 (더 간결하게)
            const label = this.getLabelForValue(value);
            if (!label) return '';

            try {
              const date = new Date(label);
              // 모바일에서는 DD 형식, 데스크톱에서는 MM/DD 형식
              return window.innerWidth < 768
                ? date.getDate().toString()
                : `${date.getMonth() + 1}/${date.getDate()}`;
            } catch (e) {
              return '';
            }
          },
        },
        grid: {
          display: false,
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        display: true,
        position: 'right', // Y축을 오른쪽에 배치하여 공간 확보
        grid: {
          display: false, // 그리드 제거
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          display: window.innerWidth >= 768, // 모바일에서는 Y축 틱 숨김 (공간 확보)
          maxTicksLimit: 4, // 틱 수 최소화
          padding: 0, // 패딩 제거
          font: {
            size: 9, // 작은 폰트 사이즈
          },
          callback: function (value) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(0) + 'K';
            }
            return value;
          },
        },
      },
    },
  };

  // 개별 차트 옵션 - 공매도 비중(%)용 추가
  const shortRatioChartOptions = {
    ...individualChartOptions,
    scales: {
      ...individualChartOptions.scales,
      y: {
        ...individualChartOptions.scales.y,
        title: {
          display: true,
          text: '비중(%)',
        },
        ticks: {
          callback: function (value) {
            return value.toFixed(2);
          },
        },
      },
    },
  };

  const chartData = prepareChartData();
  //   console.log('최종 차트 데이터:', chartData);

  return (
    <div className="px-0 mt-0">
      <Card className="border-0 shadow-sm mb-2">
        <Card.Body className="p-0 pb-2">
          {/* 메인 차트 */}
          <Row className="m-0">
            <Col md={12} className="p-0 mb-2">
              {chartData ? (
                <div
                  style={{
                    height: window.innerWidth < 768 ? '300px' : '380px',
                    padding: '0 2px', // 좌우 패딩을 최소화
                  }}
                >
                  <Line data={chartData.main} options={mainChartOptions} />
                </div>
              ) : (
                <Alert variant="info">
                  차트를 그릴 데이터가 충분하지 않습니다.
                  <div className="mt-2">
                    <strong>디버깅 정보:</strong>
                    <pre className="mt-1" style={{ fontSize: '0.8rem' }}>
                      {JSON.stringify(
                        {
                          loanDataExists: !!loanData,
                          shortDataExists: !!shortData,
                          loanDataLength: loanData?.length || 0,
                          shortDataLength: shortData?.length || 0,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </Alert>
              )}
            </Col>
          </Row>

          {/* 개별 차트 섹션 - 완전히 새롭게 구성 */}
          {chartData && (
            <>
              <h5
                className="mb-2 px-2"
                style={{
                  fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem',
                  fontWeight: 'bold',
                }}
              >
                개별 지표 추이
              </h5>
              <div className="px-1">
                {/* 공매도 비중 차트 */}
                <div className="mb-3">
                  <div
                    className="bg-light py-1 px-2 d-flex align-items-center"
                    style={{
                      height: '28px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '4px 4px 0 0',
                    }}
                  >
                    공매도 비중(%)
                  </div>
                  <div
                    style={{
                      height: window.innerWidth < 768 ? '180px' : '220px',
                      background: '#fcfcfc',
                      padding: '4px 0',
                    }}
                  >
                    <Line
                      data={chartData.shortRatio}
                      options={{
                        ...individualChartOptions,
                        scales: {
                          ...individualChartOptions.scales,
                          y: {
                            ...individualChartOptions.scales.y,
                            min: 0,
                            suggestedMax:
                              Math.max(
                                ...chartData.shortRatio.datasets[0].data.filter(
                                  (d) => d !== null
                                )
                              ) * 1.1,
                            ticks: {
                              display: true, // Y축 항상 표시
                              maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
                              font: {
                                size: window.innerWidth < 768 ? 8 : 10,
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* 대차잔여주식수 차트 */}
                <div className="mb-3">
                  <div
                    className="bg-light py-1 px-2 d-flex align-items-center"
                    style={{
                      height: '28px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '4px 4px 0 0',
                    }}
                  >
                    대차잔여주식수
                  </div>
                  <div
                    style={{
                      height: window.innerWidth < 768 ? '180px' : '220px',
                      background: '#fcfcfc',
                      padding: '4px 0',
                    }}
                  >
                    <Line
                      data={chartData.loanBalance}
                      options={{
                        ...individualChartOptions,
                        scales: {
                          ...individualChartOptions.scales,
                          y: {
                            ...individualChartOptions.scales.y,
                            min: chartData.loanBalance.yRange?.min || 0,
                            suggestedMax: chartData.loanBalance.yRange?.max,
                            ticks: {
                              display: true, // Y축 항상 표시
                              maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
                              font: {
                                size: window.innerWidth < 768 ? 8 : 10,
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* 공매도 차트 */}
                <div className="mb-3">
                  <div
                    className="bg-light py-1 px-2 d-flex align-items-center"
                    style={{
                      height: '28px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '4px 4px 0 0',
                    }}
                  >
                    공매도
                  </div>
                  <div
                    style={{
                      height: window.innerWidth < 768 ? '180px' : '220px',
                      background: '#fcfcfc',
                      padding: '4px 0',
                    }}
                  >
                    <Line
                      data={chartData.shortVolume}
                      options={{
                        ...individualChartOptions,
                        scales: {
                          ...individualChartOptions.scales,
                          y: {
                            ...individualChartOptions.scales.y,
                            min: chartData.shortVolume.yRange?.min || 0,
                            suggestedMax: chartData.shortVolume.yRange?.max,
                            ticks: {
                              display: true, // Y축 항상 표시
                              maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
                              font: {
                                size: window.innerWidth < 768 ? 8 : 10,
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* 매수 차트 */}
                <div className="mb-3">
                  <div
                    className="bg-light py-1 px-2 d-flex align-items-center"
                    style={{
                      height: '28px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderRadius: '4px 4px 0 0',
                    }}
                  >
                    매수
                  </div>
                  <div
                    style={{
                      height: window.innerWidth < 768 ? '180px' : '220px',
                      background: '#fcfcfc',
                      padding: '4px 0',
                    }}
                  >
                    <Line
                      data={chartData.buyVolume}
                      options={{
                        ...individualChartOptions,
                        scales: {
                          ...individualChartOptions.scales,
                          y: {
                            ...individualChartOptions.scales.y,
                            min: chartData.buyVolume.yRange?.min || 0,
                            suggestedMax: chartData.buyVolume.yRange?.max,
                            ticks: {
                              display: true, // Y축 항상 표시
                              maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
                              font: {
                                size: window.innerWidth < 768 ? 8 : 10,
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 테이블 섹션 */}
          <div className="px-1 mt-2">
            {window.innerWidth < 768 && (
              <div
                className="text-center text-muted mb-1"
                style={{ fontSize: '0.7rem' }}
              >
                <span>← 테이블 좌우 스크롤 →</span>
              </div>
            )}

            <h5
              className="mb-1 px-1"
              style={{
                fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem',
                fontWeight: 'bold',
              }}
            >
              대차 정보
            </h5>
            <div className="table-responsive px-0">
              <Table
                striped
                bordered
                hover
                responsive
                className="mb-1"
                style={{
                  fontSize: window.innerWidth < 768 ? '0.7rem' : '0.85rem',
                }}
              >
                <thead className={window.innerWidth < 768 ? 'table-light' : ''}>
                  <tr>
                    <th
                      style={{
                        width: '20%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      일자
                    </th>
                    <th
                      style={{
                        width: '20%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      대차잔여주식수
                    </th>
                    <th
                      style={{
                        width: '20%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      대차잔액
                    </th>
                    <th
                      style={{
                        width: '20%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      대차체결주식수
                    </th>
                    <th
                      style={{
                        width: '20%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      상환주식수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loanData &&
                    Array.isArray(loanData) &&
                    [...loanData]
                      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
                      .slice(0, window.innerWidth < 768 ? 10 : 20) // 모바일에서는 데이터 수 제한
                      .map((item, index) => (
                        <tr key={`loan-${index}`}>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {item.Date}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.대차잔여주식수)}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.대차잔액)}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.대차체결주식수)}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.상환주식수)}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </Table>
            </div>

            <h5
              className="mb-1 mt-2 px-1"
              style={{
                fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem',
                fontWeight: 'bold',
              }}
            >
              공매도 정보
            </h5>
            <div className="table-responsive px-0">
              <Table
                striped
                bordered
                hover
                responsive
                style={{
                  fontSize: window.innerWidth < 768 ? '0.7rem' : '0.85rem',
                }}
              >
                <thead className={window.innerWidth < 768 ? 'table-light' : ''}>
                  <tr>
                    <th
                      style={{
                        width: '25%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      일자
                    </th>
                    <th
                      style={{
                        width: '25%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      공매도
                    </th>
                    <th
                      style={{
                        width: '25%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      매수
                    </th>
                    <th
                      style={{
                        width: '25%',
                        padding: window.innerWidth < 768 ? '0.25rem' : '0.5rem',
                      }}
                    >
                      비중(%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shortData &&
                    Array.isArray(shortData) &&
                    [...shortData]
                      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
                      .slice(0, window.innerWidth < 768 ? 10 : 20) // 모바일에서는 데이터 수 제한
                      .map((item, index) => (
                        <tr key={`short-${index}`}>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {item.Date}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.공매도)}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {formatNumber(item.매수)}
                          </td>
                          <td
                            style={{
                              padding:
                                window.innerWidth < 768 ? '0.2rem' : '0.5rem',
                            }}
                          >
                            {item.비중.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default StockLoanShort;

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

const StockLoanShort = ({ stockCode, ohlcvData }) => {
  const user = useSelector(selectUser);
  const [loanData, setLoanData] = useState(null);
  const [shortData, setShortData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 거래량 20일 이동평균 계산 - 디버깅 로그 확장
  const volumeMA20Data = useMemo(() => {
    if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
      console.log('OHLCV 데이터가 없습니다.');
      return null;
    }

    // 전체 데이터 로깅
    // console.log('OHLCV 데이터 샘플(첫 항목):', ohlcvData[0]);
    // console.log('OHLCV 데이터 길이:', ohlcvData.length);

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
  }, [ohlcvData]);

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
        pointRadius: 3,
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
        pointRadius: 3,
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
        pointRadius: 3,
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
        pointRadius: 3,
        borderDash: [5, 5], // 점선으로 표시
      },
    ];

    // 개별 차트용 데이터셋 준비
    const prepareIndividualChartData = (label, data, color) => {
      return {
        labels: validDates,
        datasets: [
          {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.2)'),
            tension: 0.1,
            pointRadius: 2,
            fill: true,
          },
        ],
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
          size: 16,
          weight: 'bold',
        },
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
      },
      legend: {
        position: 'top',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '날짜',
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: '주식수',
        },
        min: 0,
        ticks: {
          callback: function (value) {
            return Math.round(value).toLocaleString(); // 정수로 반올림하여 표시
          },
        },
      },
      // y1 축 제거 - 모든 데이터는 y축에 표시
    },
  };

  // 개별 차트 공통 옵션
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
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          display: true, // 날짜 표시 활성화
          autoSkip: true,
          maxTicksLimit: 6, // 표시할 틱 수 제한
          maxRotation: 45, // 날짜 레이블 회전
          minRotation: 45,
          callback: function (value, index, ticks) {
            // 날짜 포맷팅
            const label = this.getLabelForValue(value);
            if (!label) return '';

            try {
              const date = new Date(label);
              return date
                .toLocaleDateString('ko-KR', {
                  month: '2-digit',
                  day: '2-digit',
                })
                .replace(/\./g, '/'); // MM/DD 형식으로 표시
            } catch (e) {
              return label;
            }
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        ticks: {
          callback: function (value) {
            return Math.round(value).toLocaleString(); // 정수로 변환하여 표시
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
    <div>
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          {/* 메인 차트 */}
          <Row>
            <Col md={12} className="mb-4">
              {chartData ? (
                <div style={{ height: '400px' }}>
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

          {/* 개별 차트 섹션 - 하나씩 크게 표시하도록 변경 */}
          {chartData && (
            <>
              <h5 className="mb-3">개별 지표 추이</h5>

              {/* 공매도 비중 차트 */}
              <Card className="mb-4">
                <Card.Header className="py-2 bg-light">
                  <strong>공매도 비중(%) 추이</strong>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: '300px' }}>
                    <Line
                      data={chartData.shortRatio}
                      options={shortRatioChartOptions}
                    />
                  </div>
                </Card.Body>
              </Card>

              {/* 대차잔여주식수 차트 */}
              <Card className="mb-4">
                <Card.Header className="py-2 bg-light">
                  <strong>대차잔여주식수 추이</strong>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: '300px' }}>
                    <Line
                      data={chartData.loanBalance}
                      options={individualChartOptions}
                    />
                  </div>
                </Card.Body>
              </Card>

              {/* 공매도 차트 */}
              <Card className="mb-4">
                <Card.Header className="py-2 bg-light">
                  <strong>공매도 추이</strong>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: '300px' }}>
                    <Line
                      data={chartData.shortVolume}
                      options={individualChartOptions}
                    />
                  </div>
                </Card.Body>
              </Card>

              {/* 매수 차트 */}
              <Card className="mb-4">
                <Card.Header className="py-2 bg-light">
                  <strong>매수 추이</strong>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: '300px' }}>
                    <Line
                      data={chartData.buyVolume}
                      options={individualChartOptions}
                    />
                  </div>
                </Card.Body>
              </Card>
            </>
          )}

          {/* 테이블 섹션 - 단위를 헤더에 표시하고 데이터에서 제거 */}
          <Row className="mt-4">
            <Col md={12}>
              <h5 className="mb-3">대차 정보</h5>
              <Table striped bordered hover responsive className="mb-4">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>대차잔여주식수 (주)</th>
                    <th>대차잔액 (원)</th>
                    <th>대차체결주식수 (주)</th>
                    <th>상환주식수 (주)</th>
                  </tr>
                </thead>
                <tbody>
                  {loanData &&
                    Array.isArray(loanData) &&
                    [...loanData]
                      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
                      .map((item, index) => (
                        <tr key={`loan-${index}`}>
                          <td>{item.Date}</td>
                          <td>{formatNumber(item.대차잔여주식수)}</td>
                          <td>{formatNumber(item.대차잔액)}</td>
                          <td>{formatNumber(item.대차체결주식수)}</td>
                          <td>{formatNumber(item.상환주식수)}</td>
                        </tr>
                      ))}
                </tbody>
              </Table>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <h5 className="mb-3">공매도 정보</h5>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>공매도 (주)</th>
                    <th>매수 (주)</th>
                    <th>비중 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {shortData &&
                    Array.isArray(shortData) &&
                    [...shortData]
                      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
                      .map((item, index) => (
                        <tr key={`short-${index}`}>
                          <td>{item.Date}</td>
                          <td>{formatNumber(item.공매도)}</td>
                          <td>{formatNumber(item.매수)}</td>
                          <td>{item.비중.toFixed(2)}</td>
                        </tr>
                      ))}
                </tbody>
              </Table>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default StockLoanShort;

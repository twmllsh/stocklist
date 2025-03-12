import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, ButtonGroup, Button, Nav, Tab, Form } from 'react-bootstrap'; // Form 추가
import { useSelector, useDispatch } from 'react-redux';
import { selectStocks } from '../../store/slices/stockSlice';
import { stockService } from '../../services/stockService'; // 추가: stockService import
import CandlestickChart from './CandlestickChart';
import { getPriceColor, formatNumber } from '../../utils/formatters';
import { BiRefresh } from 'react-icons/bi'; // IoRefresh 대신 BiRefresh 사용
import StockConsensus from './tabs/StockConsensus';
import StockIssue from './tabs/StockIssue';
import StockNews from './tabs/StockNews';
import StockInvestor from './tabs/StockInvestor';
import StockBroker from './tabs/StockBroker'; // 새로운 import 추가
import StockDisclosure from './tabs/StockDisclosure'; // 새로운 import 추가
import StockMainDisclosure from './tabs/StockMainDisclosure'; // 새로운 import 추가
import { AiFillStar, AiOutlineStar } from 'react-icons/ai'; // 별 아이콘 추가
import {
  selectFavorites,
  toggleFavoriteStock,
  fetchFavorites, // 상단에 import 추가
} from '../../store/slices/favoriteSlice';
import StockAI from './tabs/StockAI'; // 상단에 import 추가
import { selectUser } from '../../store/slices/authSlice'; // 상단에 추가

const ChartModal = ({
  show,
  onHide,
  chartData,
  stockCode,
  onIntervalChange,
}) => {
  const dispatch = useDispatch();
  const stocks = useSelector(selectStocks);
  const favorites = useSelector(selectFavorites);
  const user = useSelector(selectUser); // 사용자 정보 가져오기
  const selectedStock = stocks.find((stock) => stock.code === stockCode);

  const [interval, setInterval] = useState('day');
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState({});
  const [currentData, setCurrentData] = useState(null);
  const [activeTab, setActiveTab] = useState('consensus');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [buyPrice, setBuyPrice] = useState('');
  const [localBuyPrice, setLocalBuyPrice] = useState(0); // 새로운 state 추가
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisKey, setAnalysisKey] = useState(0); // AI 분석 컴포넌트 리렌더링용 키

  // 지표 상태는 유지
  const [visibleIndicators, setVisibleIndicators] = useState({
    ma3: true,
    ma20: true,
    ma60: true,
    ma120: false,
    ma240: true,
    bb60: false,
    bb240: true,
    showDisclosure: true, // 주요공시를 기본값으로 true로 설정
    showAiOpinion: true, // AI 의견 표시 여부 추가
  });

  // 주요공시 데이터 상태 추가
  const [mainDisclosureData, setMainDisclosureData] = useState([]);

  // AI 의견 데이터 상태 추가
  const [aiOpinionData, setAiOpinionData] = useState([]);

  // AI 분석 데이터 상태 추가
  const [latestAiOpinion, setLatestAiOpinion] = useState(null);

  // 체크버튼 상태 유지를 위한 ref 추가
  const buttonStateRef = useRef({
    indicators: null,
    interval: null,
  });

  // 모달이 처음 열릴 때만 실행
  useEffect(() => {
    if (show && !buttonStateRef.current.indicators) {
      buttonStateRef.current.indicators = visibleIndicators;
      buttonStateRef.current.interval = 'day';
    }
  }, [show]);

  // 모달이 닫힐 때 초기화 함수 수정
  useEffect(() => {
    if (!show) {
      setCachedData({});
      setCurrentData(null);
      // 체크버튼 상태는 유지하고 캐시만 초기화
      if (
        buttonStateRef.current.indicators &&
        buttonStateRef.current.interval
      ) {
        setVisibleIndicators(buttonStateRef.current.indicators);
        setInterval(buttonStateRef.current.interval);
      }
    }
  }, [show]);

  // 초기 데이터 설정
  useEffect(() => {
    if (show && chartData && stockCode) {
      const cacheKey = `${stockCode}-day`;
      setCachedData((prev) => ({
        ...prev,
        [cacheKey]: chartData,
      }));
      setCurrentData(chartData);
      setInterval('day');
    }
  }, [show, chartData, stockCode]);

  // 데이터 요청 및 캐시 관리 함수
  const fetchAndCacheData = useCallback(
    async (newInterval) => {
      setIsLoading(true);
      try {
        // API 요청용 interval 변환
        const apiInterval =
          newInterval === '30' ? '30min' : newInterval === '5' ? '5min' : 'day';

        const data = await onIntervalChange(stockCode, apiInterval);
        if (data) {
          const cacheKey = `${stockCode}-${newInterval}`;
          setCachedData((prev) => ({
            ...prev,
            [cacheKey]: data,
          }));
          setCurrentData(data);
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [stockCode, onIntervalChange]
  );

  // 인터벌 변경 처리
  const handleIntervalChange = async (newInterval) => {
    if (interval === newInterval || !stockCode) return;

    const cacheKey = `${stockCode}-${newInterval}`;
    setInterval(newInterval);
    buttonStateRef.current.interval = newInterval;

    if (cachedData[cacheKey]) {
      // 캐시된 데이터가 있으면 사용
      setCurrentData(cachedData[cacheKey]);
    } else {
      // 없으면 새로 요청
      await fetchAndCacheData(newInterval);
    }
  };

  // 지표 토글 시 상태 저장
  const toggleIndicator = (key) => {
    setVisibleIndicators((prev) => {
      const newState = {
        ...prev,
        [key]: !prev[key],
      };
      buttonStateRef.current.indicators = newState;
      return newState;
    });
  };

  // 주요공시 데이터 로드
  useEffect(() => {
    const fetchMainDisclosure = async () => {
      if (stockCode && visibleIndicators.showDisclosure) {
        try {
          const data = await stockService.getStockMainDisclosure(stockCode);
          setMainDisclosureData(data);
        } catch (error) {
          console.error('주요공시 데이터 로드 실패:', error);
        }
      }
    };

    fetchMainDisclosure();
  }, [stockCode, visibleIndicators.showDisclosure]);

  // AI 의견 데이터 로드 수정
  useEffect(() => {
    const fetchAiOpinion = async () => {
      if (stockCode && visibleIndicators.showAiOpinion) {
        try {
          console.log('기존 AI 의견 요청:', {
            ticker: stockCode,
            anal: false,
          });
          const response = await stockService.getOpinionForStock(stockCode, {
            anal: false,
          });
          console.log('기존 AI 의견 응답:', response);

          if (Array.isArray(response)) {
            setAiOpinionData(response);
          } else if (response) {
            setAiOpinionData([response]);
          }
        } catch (error) {
          console.error('AI 의견 데이터 로드 실패:', error);
        }
      }
    };

    fetchAiOpinion();
  }, [stockCode, visibleIndicators.showAiOpinion]);

  // 새로고침 처리
  const handleRefresh = async () => {
    await fetchAndCacheData(interval);
  };

  // 탭 변경 핸들러 수정
  const handleTabSelect = (key) => {
    // console.log('===== 탭 클릭 =====');
    // console.log('선택된 탭:', key);
    // console.log('현재 종목 코드:', stockCode);
    setActiveTab(key);
  };

  // 즐겨찾기 상태 초기화
  useEffect(() => {
    if (show && stockCode) {
      const isFav = favorites.includes(stockCode);
      setIsFavorite(isFav);
    }
  }, [show, stockCode, favorites]);

  // selectedStock이나 buy_price가 변경될 때마다 localBuyPrice 업데이트
  useEffect(() => {
    setLocalBuyPrice(selectedStock?.buy_price || 0);
  }, [selectedStock?.buy_price]);

  // 즐겨찾기 토글 핸들러
  const handleFavoriteToggle = async () => {
    try {
      await dispatch(toggleFavoriteStock(stockCode)).unwrap();
    } catch (error) {
      console.error('즐겨찾기 처리 실패:', error);
    }
  };

  // 매수가격 수정 핸들러
  const handlePriceEdit = () => {
    setIsEditingPrice(true);
    setBuyPrice(selectedStock?.buy_price || '');
  };

  // 매수가격 입력 처리 핸들러 추가
  const handlePriceChange = (e) => {
    const value = e.target.value;
    // 숫자와 소수점만 허용
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBuyPrice(value);
    }
  };

  // 매수가격 저장 핸들러 수정
  const handlePriceSave = async () => {
    try {
      const numericPrice = buyPrice === '' ? 0 : parseFloat(buyPrice);
      if (buyPrice !== '' && isNaN(numericPrice)) {
        alert('유효한 숫자를 입력해주세요.');
        return;
      }
      await stockService.updateBuyPrice(stockCode, numericPrice);
      setIsEditingPrice(false);
      await dispatch(fetchFavorites());
      setLocalBuyPrice(numericPrice);
    } catch (error) {
      console.error('매수가격 업데이트 실패:', error);
    }
  };

  const getDisplayBuyPrice = (buyPrice) => {
    return buyPrice ? formatNumber(buyPrice) : '-';
  };

  // 수익률 표시 함수 수정
  const getProfitDisplay = (buyPrice, currentPrice) => {
    if (!buyPrice || !currentPrice) return null;

    const profitRate = (((currentPrice - buyPrice) / buyPrice) * 100).toFixed(
      2
    );
    return (
      <div className="mt-1" style={{ fontSize: '0.9rem' }}>
        <span
          className={
            profitRate > 0
              ? 'text-danger'
              : profitRate < 0
              ? 'text-primary'
              : ''
          }
        >
          수익률: {profitRate > 0 ? '+' : ''}
          {profitRate}%
        </span>
      </div>
    );
  };

  // 마지막 종가 가져오기
  const getLastClosePrice = () => {
    if (!currentData || currentData.length === 0) return null;
    return currentData[currentData.length - 1].Close;
  };

  // 모달 정보 로깅을 위한 useEffect 수정
  useEffect(() => {
    // console.log('Show 상태 변경:', show);
    // console.log('현재 선택된 종목:', selectedStock);
    // console.log('현재 사용자:', user);
    // if (show && stockCode && selectedStock) {
    //   console.group('===== 모달 정보 =====');
    //   console.log('선택된 종목:', selectedStock?.종목명);
    //   console.log('종목코드:', stockCode);
    //   console.log('현재가:', selectedStock?.현재가);
    //   console.log('등락률:', selectedStock?.등락률);
    //   console.log('사용자 정보:', user);
    //   console.log('회원등급:', user?.membership);
    //   console.log('즐겨찾기 여부:', favorites.includes(stockCode));
    //   console.log('매수가:', selectedStock?.buy_price);
    //   console.groupEnd();
    // }
  }, [show, stockCode, selectedStock, user, favorites]); // 의존성 배열 수정

  // 사용자 정보 디버깅을 위한 useEffect
  // useEffect(() => {
  //   if (user) {
  //     console.group('===== User Info Debug =====');
  //     console.log('User object:', user);
  //     console.log('Membership:', user?.membership);
  //     console.log('Is special?:', user?.membership === 'SPECIAL');
  //     console.groupEnd();
  //   }
  // }, [user]);

  const requestNewAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      console.log('AI 의견 요청:', {
        ticker: stockCode,
        anal: true,
      });
      const response = await stockService.getOpinionForStock(stockCode, {
        anal: true,
      });
      console.log('AI 의견 응답:', response);

      if (response && !response.error) {
        setActiveTab('ai');
        setAnalysisKey((prev) => prev + 1);
        setLatestAiOpinion(response);
      }
    } catch (error) {
      console.error('AI 분석 요청 실패:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 접근 권한 체크 함수 분리
  const canViewAI =
    user?.membership === 'REGULAR' || user?.membership === 'SPECIAL';
  const canRequestAI = user?.membership === 'SPECIAL';

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center">
            <span>{selectedStock?.종목명}</span>
            <Button
              variant="link"
              className="p-0 ms-2"
              onClick={handleFavoriteToggle}
            >
              {isFavorite ? (
                <AiFillStar size={20} color="#ffd700" />
              ) : (
                <AiOutlineStar size={20} />
              )}
            </Button>
          </div>
          {selectedStock && (
            <div
              className="d-flex align-items-center gap-3"
              style={{ fontSize: '0.9rem' }}
            >
              <span className={`${getPriceColor(selectedStock.등락률)}`}>
                {formatNumber(selectedStock.현재가)} (
                {parseFloat(selectedStock.등락률).toFixed(1)}%)
              </span>
              {/* AI 분석 버튼은 특별회원만 */}
              {canRequestAI && (
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={requestNewAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? '분석중...' : 'AI 분석'}
                </Button>
              )}
              {isFavorite && (
                <div className="d-flex flex-column">
                  <span className="text-muted">
                    평균매수가: {getDisplayBuyPrice(localBuyPrice)}
                  </span>
                  {localBuyPrice > 0 &&
                    getProfitDisplay(localBuyPrice, selectedStock?.현재가)}
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="ms-1 py-0 mt-1"
                    onClick={handlePriceEdit}
                  >
                    수정
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="d-flex justify-content-between align-items-center px-3 py-2">
          {/* 왼쪽: 보조지표 버튼 */}
          <div className="d-flex gap-1 flex-wrap" style={{ maxWidth: '70%' }}>
            {[
              { key: 'ma3', label: 'MA3', color: 'black' },
              { key: 'ma20', label: 'MA20', color: 'red' },
              { key: 'ma60', label: 'MA60', color: 'blue' },
              { key: 'ma120', label: 'MA120', color: 'green' },
              { key: 'ma240', label: 'MA240', color: '#999a9e' },
              { key: 'bb60', label: 'BB60', color: '#2962FF' },
              { key: 'bb240', label: 'BB240', color: '#E91E63' },
              { key: 'showDisclosure', label: '주요공시', color: '#6f42c1' }, // 보라색 계열
              { key: 'showAiOpinion', label: 'AI의견', color: '#FF5722' }, // AI 의견 버튼 추가
            ].map(({ key, label, color }) => (
              <Button
                key={key}
                size="sm"
                variant="light"
                onClick={() => toggleIndicator(key)}
                style={{
                  padding: '2px 6px',
                  fontSize: '0.7rem',
                  backgroundColor: visibleIndicators[key] ? color : '#f8f9fa',
                  color: visibleIndicators[key] ? 'white' : '#666',
                  border: '1px solid #dee2e6',
                  minWidth: '42px',
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* 오른쪽: 새로고침 버튼과 인터벌 버튼들 */}
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="light"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              title={`${
                interval === 'day'
                  ? '일봉'
                  : interval === '30'
                  ? '30분봉'
                  : '5분봉'
              } 새로고침`}
            >
              <BiRefresh className={isLoading ? 'rotating' : ''} />
            </Button>
            <ButtonGroup size="sm">
              {[
                { key: 'day', label: '일봉' },
                { key: '30', label: '30분' },
                { key: '5', label: '5분' },
              ].map((btn) => (
                <Button
                  key={btn.key}
                  variant={interval === btn.key ? 'dark' : 'outline-dark'}
                  onClick={() => handleIntervalChange(btn.key)}
                  disabled={isLoading}
                >
                  {btn.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>

        <div
          className="chart-container position-relative"
          style={{ minHeight: '400px' }}
        >
          {isLoading && (
            <div className="position-absolute w-100 h-100 d-flex justify-content-center align-items-center bg-light bg-opacity-75">
              데이터 로딩 중...
            </div>
          )}
          {currentData && currentData.length > 0 && (
            <CandlestickChart
              key={`${stockCode}-${interval}`}
              data={currentData}
              visibleIndicators={visibleIndicators}
              mainDisclosureData={mainDisclosureData}
              aiOpinionData={
                latestAiOpinion ? [latestAiOpinion] : aiOpinionData
              } // 새로운 분석 결과 전달
            />
          )}
        </div>

        {/* Tabs Section */}
        <Tab.Container activeKey={activeTab} onSelect={handleTabSelect}>
          <Nav variant="tabs" className="mt-3">
            <Nav.Item>
              <Nav.Link eventKey="investor">투자자</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="broker">거래원</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="consensus">컨센서스</Nav.Link>
            </Nav.Item>
            {canViewAI && (
              <Nav.Item>
                <Nav.Link eventKey="ai">AI 의견</Nav.Link>
              </Nav.Item>
            )}
            <Nav.Item>
              <Nav.Link eventKey="disclosure">공시</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="mainDisclosure">주요공시</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="issue">이슈</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="news">뉴스</Nav.Link>
            </Nav.Item>
          </Nav>
          <Tab.Content className="p-3">
            <Tab.Pane eventKey="investor" mountOnEnter unmountOnExit>
              {activeTab === 'investor' && (
                <StockInvestor
                  key={`investor-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
            <Tab.Pane eventKey="broker" mountOnEnter unmountOnExit>
              {activeTab === 'broker' && (
                <StockBroker
                  key={`broker-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
            <Tab.Pane eventKey="consensus" mountOnEnter>
              {activeTab === 'consensus' && (
                <StockConsensus stockCode={stockCode} />
              )}
            </Tab.Pane>
            {canViewAI && (
              <Tab.Pane eventKey="ai" mountOnEnter unmountOnExit>
                {activeTab === 'ai' && (
                  <StockAI
                    key={`ai-${stockCode}-${activeTab}-${analysisKey}`}
                    stockCode={stockCode}
                    anal={false}
                  />
                )}
              </Tab.Pane>
            )}
            <Tab.Pane eventKey="disclosure" mountOnEnter unmountOnExit>
              {activeTab === 'disclosure' && (
                <StockDisclosure
                  key={`disclosure-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
            <Tab.Pane eventKey="mainDisclosure" mountOnEnter unmountOnExit>
              {activeTab === 'mainDisclosure' && (
                <StockMainDisclosure
                  key={`mainDisclosure-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
            <Tab.Pane eventKey="issue" mountOnEnter unmountOnExit>
              {activeTab === 'issue' && (
                <StockIssue
                  key={`issue-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
            <Tab.Pane eventKey="news" mountOnEnter unmountOnExit>
              {activeTab === 'news' && (
                <StockNews
                  key={`news-${stockCode}-${activeTab}`}
                  stockCode={stockCode}
                />
              )}
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
};

export default ChartModal;

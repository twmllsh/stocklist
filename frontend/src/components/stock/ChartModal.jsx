import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, ButtonGroup, Button, Nav, Tab } from 'react-bootstrap';
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
import { AiFillStar, AiOutlineStar } from 'react-icons/ai'; // 별 아이콘 추가
import {
  selectFavorites,
  toggleFavoriteStock,
} from '../../store/slices/favoriteSlice';

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
  const selectedStock = stocks.find((stock) => stock.code === stockCode);

  const [interval, setInterval] = useState('day');
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState({});
  const [currentData, setCurrentData] = useState(null);
  const [activeTab, setActiveTab] = useState('consensus');
  const [isFavorite, setIsFavorite] = useState(false);

  // 지표 상태는 유지
  const [visibleIndicators, setVisibleIndicators] = useState({
    ma3: true,
    ma20: true,
    ma60: true,
    ma120: false,
    ma240: true,
    bb60: false,
    bb240: true,
  });

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

  // 즐겨찾기 토글 핸들러
  const handleFavoriteToggle = async () => {
    try {
      await dispatch(toggleFavoriteStock(stockCode)).unwrap();
    } catch (error) {
      console.error('즐겨찾기 처리 실패:', error);
    }
  };

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
                {formatNumber(selectedStock.현재가)} ({selectedStock.등락률}%)
              </span>
              <span className="text-muted">
                거래량: {formatNumber(selectedStock.거래량)}
              </span>
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
            <Nav.Item>
              <Nav.Link eventKey="disclosure">공시</Nav.Link>
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
            <Tab.Pane eventKey="disclosure" mountOnEnter unmountOnExit>
              {activeTab === 'disclosure' && (
                <StockDisclosure
                  key={`disclosure-${stockCode}-${activeTab}`}
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

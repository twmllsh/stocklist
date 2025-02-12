import { useSelector } from 'react-redux';
import {
  selectStocks,
  selectStockLoading,
  selectStockError,
} from '../../store/slices/stockSlice';
import { Row, Col } from 'react-bootstrap';
import StockCard from './StockCard';
import { useState, useEffect } from 'react';
import { stockService } from '../../services/stockService';
import ChartModal from './ChartModal';

const FilteredList = () => {
  const stocks = useSelector(selectStocks);
  const loading = useSelector(selectStockLoading);
  const error = useSelector(selectStockError);

  const [sortType, setSortType] = useState('volumeRatio');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showModal, setShowModal] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [selectedStockCode, setSelectedStockCode] = useState(null);

  const sortButtons = [
    { key: 'volumeRatio', label: '거래량/vol20' },
    { key: 'volume', label: '거래량' },
    { key: 'change', label: '등락률' },
    { key: 'reserve', label: '유보율' },
    { key: 'debt', label: '부채비율' },
    { key: 'tradeRatio', label: '매도/매수' },
  ];

  useEffect(() => {
    const savedSort = sessionStorage.getItem('stockSortSettings');
    if (savedSort) {
      const { type, direction } = JSON.parse(savedSort);
      setSortType(type);
      setSortDirection(direction);
    }
  }, []);

  const handleSort = (buttonKey) => {
    let newDirection = sortDirection;
    if (sortType === buttonKey) {
      newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      setSortDirection(newDirection);
    } else {
      newDirection = 'desc';
      setSortDirection(newDirection);
      setSortType(buttonKey);
    }

    sessionStorage.setItem(
      'stockSortSettings',
      JSON.stringify({ type: buttonKey, direction: newDirection })
    );
  };

  const getSortedStocks = () => {
    if (!Array.isArray(stocks)) {
      // console.log('stocks is not an array:', stocks);
      return [];
    }

    // console.log('Original stocks:', stocks);
    const sorted = [...stocks].sort((a, b) => {
      switch (sortType) {
        case 'volume':
          const volumeA = parseInt(a.거래량) || 0;
          const volumeB = parseInt(b.거래량) || 0;
          return sortDirection === 'desc'
            ? volumeB - volumeA
            : volumeA - volumeB;
        case 'change':
          const changeA = parseFloat(a.등락률) || 0;
          const changeB = parseFloat(b.등락률) || 0;
          return sortDirection === 'desc'
            ? changeB - changeA
            : changeA - changeB;

        case 'reserve':
          const reserveA = parseFloat(a.유보율) || 0;
          const reserveB = parseFloat(b.유보율) || 0;
          return sortDirection === 'desc'
            ? reserveB - reserveA
            : reserveA - reserveB;

        case 'debt':
          const debtA = parseFloat(a.부채비율) || 0;
          const debtB = parseFloat(b.부채비율) || 0;
          return sortDirection === 'desc' ? debtB - debtA : debtA - debtB;

        case 'tradeRatio':
          const ratioA = a.매도총잔량 / a.매수총잔량 || 0;
          const ratioB = b.매도총잔량 / b.매수총잔량 || 0;
          return sortDirection === 'desc' ? ratioB - ratioA : ratioA - ratioB;

        case 'volumeRatio':
          const volRatioA = a.거래량 / a.vol20 || 0;
          const volRatioB = b.거래량 / b.vol20 || 0;
          return sortDirection === 'desc'
            ? volRatioB - volRatioA
            : volRatioA - volRatioB;

        default:
          return 0;
      }
    });
    // console.log('Sorted stocks:', sorted);
    return sorted;
  };

  const handleCardClick = async (code) => {
    setSelectedStockCode(code);
    try {
      // 처음 클릭 시 일봉 데이터만 요청
      const { data } = await stockService.getStockOhlcv(code, 'day');
      const formattedData = data.map((item) => ({
        time: Math.floor(
          new Date(item.Date || item.date || item.localDate).getTime() / 1000
        ),
        open: Number(item.openPrice || item.Open || 0),
        high: Number(item.highPrice || item.High || 0),
        low: Number(item.lowPrice || item.Low || 0),
        close: Number(item.closePrice || item.Close || item.currentPrice || 0),
        volume: Number(item.volume || item.Volume || item.tradeVolume || 0),
      }));
      setChartData(formattedData);
      setShowModal(true);
    } catch (error) {
      console.error('Chart data fetch error:', error);
    }
  };

  // 차트 데이터 요청 함수는 ChartModal로 전달
  const fetchChartData = async (code, interval) => {
    try {
      const { data } = await stockService.getStockOhlcv(code, interval);
      if (!Array.isArray(data)) {
        throw new Error('잘못된 데이터 형식입니다.');
      }

      const formattedData = data.map((item) => ({
        time: Math.floor(
          new Date(item.Date || item.date || item.localDate).getTime() / 1000
        ),
        open: Number(item.openPrice || item.Open || 0),
        high: Number(item.highPrice || item.High || 0),
        low: Number(item.lowPrice || item.Low || 0),
        close: Number(item.closePrice || item.Close || item.currentPrice || 0),
        volume: Number(item.volume || item.Volume || item.tradeVolume || 0),
      }));

      return formattedData;
    } catch (error) {
      console.error('Chart data fetch error:', error);
      throw error;
    }
  };

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>에러: {error}</div>;

  const sortedStocks = getSortedStocks();

  return (
    <div>
      <div className="sort-buttons py-1 border-bottom bg-white">
        {sortButtons.map((button) => (
          <button
            key={button.key}
            onClick={() => handleSort(button.key)}
            className={`btn ${
              sortType === button.key ? 'text-primary' : 'text-secondary'
            }`}
            style={{
              border: 'none',
              background: 'none',
              padding: '2px 4px',
              fontSize: '0.75rem',
              fontWeight: sortType === button.key ? '600' : '400',
              marginRight: '4px',
            }}
          >
            {button.label}
            {sortType === button.key && (
              <small className="ms-1">
                {sortDirection === 'desc' ? '↓' : '↑'}
              </small>
            )}
          </button>
        ))}
      </div>

      <div className="px-1">
        <Row className="g-1">
          {/* {console.log('Rendering stocks:', sortedStocks)} */}
          {sortedStocks.length > 0 ? (
            sortedStocks.map((stock) => (
              <Col key={stock.code} xs={12} md={6} lg={4}>
                <StockCard
                  stock={stock}
                  onClick={() => handleCardClick(stock.code)}
                />
              </Col>
            ))
          ) : (
            <Col xs={12}>
              <div className="text-center py-2 text-muted">
                검색 결과가 없습니다. (총 {sortedStocks.length}개)
              </div>
            </Col>
          )}
        </Row>
      </div>
      <ChartModal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setChartData(null); // 모달이 닫힐 때 데이터 초기화
        }}
        chartData={chartData}
        stockCode={selectedStockCode}
        onIntervalChange={fetchChartData}
      />
    </div>
  );
};

export default FilteredList;

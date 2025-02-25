import {
  Form,
  Row,
  Col,
  Button,
  Container,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFilteredStocks,
  selectSearchCount,
} from '../../store/slices/stockSlice'; // 수정된 임포트
import { stockService } from '../../services/stockService'; // 상단에 추가

export default function Filter({ onToggle }) {
  const dispatch = useDispatch();
  const searchCount = useSelector(selectSearchCount);
  const [isOpen, setIsOpen] = useState(true);
  const [manualClose, setManualClose] = useState(false); // 수동으로 접었는지 여부
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [resultCount, setResultCount] = useState(undefined);
  const [hasResults, setHasResults] = useState(false);
  const [searchInput, setSearchInput] = useState(''); // 검색어 입력 상태 추가

  const [filters, setFilters] = useState({
    change: true,
    change_min: 2, // 최소값
    change_max: 10, // 최대값
    consen: true,
    consen_value: 20,
    turnarround: true,
    good_buy: true,
    newbra: true,
    realtime: true,
    endprice: false,
    sun_ac: false,
    sun_ac_value: 30,
    coke_up: false,
    coke_up_value: 55,
    sun_gcv: false,
    coke_gcv: false,
    array: false,
    array_exclude: true,
    ab: false,
    abv: true,
    goodwave: false,
    ac: false,
    new_listing: false,
    rsi: false,
    exp: false,
  });

  // 필터 설명 추가
  const filterDescriptions = {
    newbra: 'NEWBRA',
    good_buy: '투자자 분석종목',
    turnarround: '실적 흑자 전환',
    consen: '컨센서스 상향 종목',
    realtime: '실시간 데이터 기반 분석',
    endprice: '종가 기준 분석',
    change: '등락률 범위 내 종목',
    sun_ac: '그물망 기준값너비 이하에서 매직봉',
    coke_up: 'BB 기준값너비 이하에서 매직봉',
    sun_gcv: '그물망 돌파후 골든크로스',
    coke_gcv: 'BB 돌파후 골든크로스',
    array: '정배열',
    array_exclude: '역배열 제외',
    ab: '좋은 파동',
    abv: '최근 거래량 증가추세',
    goodwave: '20파동과 3파동 쌍바닥',
    ac: '현재 매직봉',
    new_listing: '최근상장회사중 상장일종가 돌파',
    rsi: 'RSI 내려갔다가 반등',
    exp: '실험실...',
  };

  const buttonGroups = [
    {
      //   title: 'Union',
      buttons: [
        { name: 'newbra', label: 'NEWBRA' },
        { name: 'good_buy', label: '투자자' },
        { name: 'turnarround', label: 'TA' },
        { name: 'consen', label: 'CONSEN', hasValue: true },
      ],
      collapsible: false,
    },
    {
      //   title: '그룹 2',
      buttons: [
        { name: 'realtime', label: '실시간' },
        { name: 'endprice', label: '종가' },
        {
          name: 'change',
          label: '등락률',
          hasValue: true,
          hasRangeValue: true,
          minValue: 'change_min', // 최소값 필드명
          maxValue: 'change_max', // 최대값 필드명
        },
      ],
    },
    {
      //   title: '그룹 3',
      buttons: [
        { name: 'sun_ac', label: 'SUN AC', hasValue: true },
        { name: 'coke_up', label: 'COKE UP', hasValue: true },
        { name: 'sun_gcv', label: 'SUN GCV' },
        { name: 'coke_gcv', label: 'COKE GCV' },
        { name: 'array', label: 'ARRAY' },
        { name: 'array_exclude', label: 'ARRAY EXCLUDE' },
      ],
    },
    {
      //   title: '그룹 4',
      buttons: [
        { name: 'ab', label: 'AB' },
        { name: 'abv', label: 'ABV' },
        { name: 'goodwave', label: 'GOODWAVE' },
        { name: 'ac', label: 'AC' },
      ],
    },
    {
      //   title: '그룹 5',
      buttons: [
        { name: 'new_listing', label: '신규상장' },
        { name: 'rsi', label: 'RSI' },
        { name: 'exp', label: 'EXP' },
      ],
    },
  ];

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: typeof value === 'undefined' ? !prev[name] : value,
    }));
  };

  const handleSearch = async () => {
    try {
      // 검색 필터 객체 생성
      const searchFilters = {};

      // 등락률 필터 처리 (change 활성화 여부와 관계없이 값이 있으면 포함)
      if (filters.change_min || filters.change_max) {
        searchFilters.change_min = filters.change_min;
        searchFilters.change_max = filters.change_max;
      }

      // 일반 필터 처리
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'change' || key === 'change_min' || key === 'change_max')
          return;

        if (key.endsWith('_value')) return;

        if (value === true) {
          // 값이 있는 필터 처리
          if (key === 'consen') {
            searchFilters[key] = filters.consen_value;
          } else if (key === 'sun_ac') {
            searchFilters[key] = filters.sun_ac_value;
          } else if (key === 'coke_up') {
            searchFilters[key] = filters.coke_up_value;
          } else {
            searchFilters[key] = true;
          }
        }
      });

      // 최종 요청 URL 로깅
      const queryString = new URLSearchParams(searchFilters).toString();
      // console.log('최종 요청 URL:', `/stocklist/?${queryString}`);

      // console.log('검색 파라미터:', searchFilters);
      await dispatch(fetchFilteredStocks(searchFilters));
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // 즐겨찾기 조회 핸들러 수정
  const handleTestFavorites = async () => {
    try {
      // console.log('[Filter] 즐겨찾기 검색 시작');
      const favoritesFilter = {
        favorites: true,
      };

      const result = await dispatch(
        fetchFilteredStocks(favoritesFilter)
      ).unwrap();
      // console.log('[Filter] 즐겨찾기 검색 결과:', result);
    } catch (error) {
      console.error('[Filter] 즐겨찾기 요청 실패:', error);
    }
  };

  // 스크롤 방향 감지 및 필터 접기 처리
  useEffect(() => {
    let lastScrollY = window.pageYOffset;

    const handleScroll = () => {
      const currentScrollY = window.pageYOffset;
      const scrollingUp = currentScrollY < lastScrollY;

      if (scrollingUp && isOpen) {
        setIsOpen(false);
        setManualClose(true); // 스크롤로 인한 접기 표시
        onToggle(false); // 스크롤 시 부모 컴포넌트에도 상태 전달
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen, onToggle]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setManualClose(!isOpen); // 수동 토글 시 manualClose 상태 업데이트
    onToggle(!isOpen); // 부모 컴포넌트에 상태 전달
  };

  // 검색어로 검색하는 핸들러 추가
  const handleSearchByText = async () => {
    if (!searchInput.trim()) return;

    try {
      setIsLoading(true);
      const updatedFilters = {
        search: searchInput.trim(), // 검색 시에는 다른 필터 제외하고 search만 전송
      };

      // console.log('종목검색 요청 데이터:', updatedFilters);
      await dispatch(fetchFilteredStocks(updatedFilters));
    } catch (error) {
      console.error('Search by text failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 버튼 렌더링 함수 수정
  const renderButton = (btn) => (
    <OverlayTrigger
      key={btn.name} // key를 여기로 이동
      placement="top"
      overlay={<Tooltip>{filterDescriptions[btn.name]}</Tooltip>}
    >
      <div className="d-flex align-items-center">
        {' '}
        {/* key 제거 */}
        <Button
          variant={filters[btn.name] ? 'success' : 'outline-success'}
          size="sm"
          onClick={() => handleFilterChange(btn.name)}
          className="me-2"
        >
          {btn.label}
        </Button>
        {btn.hasValue &&
          (btn.hasRangeValue ? (
            <div className="d-flex align-items-center gap-1">
              <Form.Control
                type="number"
                size="sm"
                style={{ width: '70px' }}
                placeholder="최소"
                value={filters[btn.minValue] || ''} // change_min 사용
                onChange={(e) =>
                  handleFilterChange(btn.minValue, e.target.value)
                }
              />
              <span>~</span>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: '70px' }}
                placeholder="최대"
                value={filters[btn.maxValue] || ''} // change_max 사용
                onChange={(e) =>
                  handleFilterChange(btn.maxValue, e.target.value)
                }
              />
            </div>
          ) : (
            <Form.Control
              type="number"
              size="sm"
              style={{ width: '70px' }}
              value={filters[`${btn.name}_value`] || ''}
              onChange={(e) =>
                handleFilterChange(`${btn.name}_value`, e.target.value)
              }
            />
          ))}
      </div>
    </OverlayTrigger>
  );

  return (
    <Container fluid className="p-0 border-bottom">
      <Form>
        <div
          style={{
            transition: 'max-height 0.3s ease-out, opacity 0.3s ease-out',
            maxHeight: isOpen ? '1000px' : '0',
            opacity: isOpen ? 1 : 0,
            overflow: 'hidden',
          }}
        >
          {buttonGroups.map((group, idx) => (
            <div key={idx}>
              <div className="mb-3">
                <h6 className="mb-2">{group.title}</h6>
                <div className="d-flex flex-wrap gap-2">
                  {group.buttons.map((btn) => renderButton(btn))}
                </div>
              </div>
              {idx === 0 && <hr className="my-3" />}{' '}
              {/* 첫 번째 그룹 다음에 구분선 추가 */}
            </div>
          ))}
        </div>

        <div className="d-flex justify-content-between align-items-center py-2 sticky-bottom bg-white">
          <div className="d-flex align-items-center" style={{ gap: '1.5rem' }}>
            {/* 조건검색 버튼 */}
            <Button
              variant="success"
              className="px-4"
              onClick={handleSearch}
              disabled={isLoading}
            >
              {isLoading ? '조건검색 중...' : '조건검색'}
            </Button>

            {/* 내종목 버튼 */}
            <Button variant="warning" onClick={handleTestFavorites}>
              내종목
            </Button>

            {/* 검색창과 검색버튼 */}
            <div className="input-group" style={{ width: '300px' }}>
              <Form.Control
                type="text"
                placeholder="종목명 또는 코드"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchByText();
                  }
                }}
              />
              <Button
                variant="outline-secondary"
                onClick={handleSearchByText}
                disabled={isLoading}
              >
                종목검색
              </Button>
            </div>

            {/* 검색 결과 카운트 */}
            {searchCount !== undefined && (
              <span className="text-secondary">
                {searchCount}개의 종목이 검색되었습니다.
              </span>
            )}
          </div>
          <Button variant="link" onClick={handleToggle} className="p-0">
            {isOpen ? '접기' : '펼치기'}
          </Button>
        </div>
      </Form>
    </Container>
  );
}

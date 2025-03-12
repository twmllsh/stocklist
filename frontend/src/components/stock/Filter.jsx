import {
  Form,
  Row,
  Col,
  Button,
  Container,
  OverlayTrigger,
  Tooltip,
  Alert, // Alert import 추가
} from 'react-bootstrap';
// import { useState, useEffect, useCallback } from 'react';
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFilteredStocks,
  selectSearchCount,
} from '../../store/slices/stockSlice'; // 수정된 임포트
import { stockService } from '../../services/stockService'; // 상단에 추가
import { selectUser } from '../../store/slices/authSlice';
import StockAiToday from './StockAiToday'; // 상단에 추가

export default function Filter({ onToggle }) {
  const user = useSelector(selectUser);
  const isBasicMember = user?.membership === 'ASSOCIATE';

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
  const [opinion, setOpinion] = useState(''); // 추가
  const [showOpinionDetail, setShowOpinionDetail] = useState(true); // 기본값을 true로 설정

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
    ab: true,
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
        { name: 'rsi', label: 'RSI' }, // RSI 버튼을 그룹 4로 이동
      ],
    },
    {
      title: 'etc..',
      buttons: [
        { name: 'new_listing', label: '신규상장' },
        { name: 'exp', label: 'EXP' },
      ],
    },
  ];

  // 버튼 컴포넌트를 별도로 분리하여 메모이제이션
  const FilterButton = React.memo(
    ({ name, label, active, onClick, variant = 'success' }) => (
      <Button
        variant={active ? variant : `outline-${variant}`}
        size="sm"
        onClick={onClick}
        className="me-2"
        style={{
          WebkitTapHighlightColor: 'transparent', // 모바일에서 탭 하이라이트 제거
          touchAction: 'manipulation', // 터치 최적화
        }}
      >
        {label}
      </Button>
    )
  );

  // 이전 상태를 저장하기 위한 ref 추가
  const previousStateRef = useRef({});

  // handleFilterChange 함수 수정
  const handleFilterChange = useCallback((name, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev };

      if (typeof value !== 'undefined') {
        newFilters[name] = value;
        return newFilters;
      }

      const newValue = !prev[name];
      newFilters[name] = newValue;

      // 그룹 2와 그룹 5 버튼들의 처리
      const group2Buttons = ['realtime', 'endprice'];
      const group5Buttons = ['new_listing', 'exp'];

      // 상태 저장이 필요한 경우 (버튼이 활성화되는 경우)
      if (newValue) {
        // 이전 상태 저장
        previousStateRef.current = {
          ...previousStateRef.current,
          group3and4: {
            group2: {
              realtime: prev.realtime,
              endprice: prev.endprice,
              change_min: prev.change_min,
              change_max: prev.change_max,
            },
            group3: {
              sun_ac: prev.sun_ac,
              coke_up: prev.coke_up,
              sun_gcv: prev.sun_gcv,
              coke_gcv: prev.coke_gcv,
              array: prev.array,
              array_exclude: prev.array_exclude,
            },
            group4: {
              ab: prev.ab,
              abv: prev.abv,
              goodwave: prev.goodwave,
              ac: prev.ac,
              rsi: prev.rsi,
            },
          },
        };

        // 그룹 2 버튼들의 상호 배타적 처리
        if (group2Buttons.includes(name)) {
          group2Buttons.forEach((btn) => {
            if (btn !== name) newFilters[btn] = false;
          });

          // realtime/endprice 특수 처리
          if (name === 'realtime') {
            newFilters.change_min = 2;
            newFilters.change_max = 10;
          } else if (name === 'endprice') {
            newFilters.change_min = -2;
            newFilters.change_max = 8;
          }
        }

        // 그룹 5 버튼들의 상호 배타적 처리
        if (group5Buttons.includes(name)) {
          group5Buttons.forEach((btn) => {
            if (btn !== name) newFilters[btn] = false;
          });

          // 그룹 3, 4 버튼들 비활성화
          [
            'sun_ac',
            'coke_up',
            'sun_gcv',
            'coke_gcv',
            'array',
            'array_exclude',
            'ab',
            'abv',
            'goodwave',
            'ac',
            'rsi',
          ].forEach((btn) => {
            newFilters[btn] = false;
          });
        }
      } else {
        // 버튼이 비활성화되는 경우
        // 그룹 5 버튼들이 모두 비활성화되었는지 확인
        const isAllGroup5Inactive = group5Buttons.every((btn) =>
          btn === name ? !newValue : !newFilters[btn]
        );

        if (isAllGroup5Inactive && previousStateRef.current.group3and4) {
          // 이전 상태 복원
          const { group2, group3, group4 } =
            previousStateRef.current.group3and4;
          Object.assign(newFilters, group2, group3, group4);
        }
      }

      return newFilters;
    });
  }, []); // 의존성 없음

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
        favorites: 'true',
      };

      // console.log('즐겨찾기 요청 URL: /stocklist/?favorites=true');
      // console.log('즐겨찾기 요청 파라미터:', favoritesFilter);

      const result = await dispatch(
        fetchFilteredStocks(favoritesFilter)
      ).unwrap();
      // console.log('즐겨찾기 응답 데이터:', result);
    } catch (error) {
      console.error('[Filter] 즐겨찾기 요청 실패:', error);
    }
  };

  // Today AI 버튼 클릭 핸들러 단순화
  const handleTodayAiClick = async () => {
    try {
      // 단순히 필터링된 주식 목록만 요청
      await dispatch(fetchFilteredStocks({ today_ai: true }));
    } catch (error) {
      console.error('Today AI 데이터 로드 실패:', error);
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

  // 컴포넌트 마운트 시 opinion 데이터 가져오기
  useEffect(() => {
    const fetchOpinion = async () => {
      try {
        // console.log('AI Opinion 요청 시작');
        const data = await stockService.getOpinion();
        // console.log('AI Opinion 응답 데이터:', data);
        // 전체 응답 데이터를 opinion 상태에 저장
        setOpinion(data);
      } catch (error) {
        console.error('Opinion 가져오기 실패:', error);
      }
    };

    fetchOpinion();
  }, []); // 컴포넌트 마운트 시에만 실행

  // 버튼 렌더링 함수 수정
  const renderButton = (btn, index) => {
    // index 매개변수 추가
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isDisabled =
      (filters.new_listing || filters.exp) &&
      [
        'sun_ac',
        'coke_up',
        'sun_gcv',
        'coke_gcv',
        'array',
        'array_exclude',
        'ab',
        'abv',
        'goodwave',
        'ac',
        'rsi',
      ].includes(btn.name);

    return (
      <div className="d-flex align-items-center" key={`${btn.name}-${index}`}>
        {' '}
        {/* key 추가 */}
        {isMobile ? (
          // 모바일에서는 OverlayTrigger 없이 버튼만 표시
          <FilterButton
            name={btn.name}
            label={btn.label}
            active={filters[btn.name]}
            onClick={() => !isDisabled && handleFilterChange(btn.name)}
            variant={isDisabled ? 'secondary' : 'success'}
            style={{ opacity: isDisabled ? 0.5 : 1 }}
          />
        ) : (
          // 데스크톱에서만 OverlayTrigger 사용
          <OverlayTrigger
            key={btn.name}
            placement="top"
            overlay={<Tooltip>{filterDescriptions[btn.name]}</Tooltip>}
            trigger={['hover', 'focus']} // 마우스 호버와 포커스에만 반응
          >
            <div>
              <FilterButton
                name={btn.name}
                label={btn.label}
                active={filters[btn.name]}
                onClick={() => !isDisabled && handleFilterChange(btn.name)}
                variant={isDisabled ? 'secondary' : 'success'}
                style={{ opacity: isDisabled ? 0.5 : 1 }}
              />
            </div>
          </OverlayTrigger>
        )}
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
    );
  };

  // 준회원 알림 메시지 컴포넌트
  const BasicMemberAlert = () => {
    if (isBasicMember) {
      return (
        <Alert variant="warning" className="mb-3">
          <p className="mb-0">
            정회원 이상 서비스를 이용할 수 있습니다. 관리자에게 문의하세요.
          </p>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Container
      fluid
      className="p-0"
      style={{
        backgroundColor: 'var(--bs-body-bg)',
        borderBottom: '1px solid var(--bs-border-color)',
        position: 'relative',
        zIndex: 1000,
      }}
    >
      {/* Alert 메시지 추가 */}
      <BasicMemberAlert />

      <Form>
        <div
          style={{
            transition: 'max-height 0.3s ease-out, opacity 0.3s ease-out',
            maxHeight: isOpen ? '1000px' : '0',
            opacity: isOpen ? 1 : 0,
            overflow: 'hidden',
            backgroundColor: 'var(--bs-body-bg)',
            padding: '1rem',
          }}
        >
          {buttonGroups.map((group, groupIdx) => (
            <div key={`group-${groupIdx}`}>
              <div className="mb-3">
                <h6 className="mb-2">{group.title}</h6>
                <div className="d-flex flex-wrap gap-2">
                  {group.buttons.map((btn, btnIdx) =>
                    renderButton(btn, `${groupIdx}-${btnIdx}`)
                  )}
                </div>
              </div>
              {groupIdx === 0 && <hr className="my-3" />}{' '}
              {/* 첫 번째 그룹 다음에 구분선 추가 */}
            </div>
          ))}
        </div>

        <div
          className="d-flex justify-content-between align-items-center py-2 px-3"
          style={{
            position: 'sticky',
            bottom: 0,
            backgroundColor: 'var(--bs-body-bg)',
            borderTop: '1px solid var(--bs-border-color)',
            zIndex: 1020,
          }}
        >
          <div className="d-flex align-items-center" style={{ gap: '1.5rem' }}>
            <div className="d-flex align-items-center gap-2">
              {/* 조건검색 버튼 */}
              <Button
                variant="success"
                className="px-4"
                onClick={handleSearch}
                disabled={isLoading || isBasicMember}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                {isLoading ? '조건검색 중...' : '조건검색'}
              </Button>
              {searchCount !== undefined && (
                <Badge bg="secondary" style={{ fontSize: '0.9rem' }}>
                  {searchCount}개
                </Badge>
              )}
            </div>

            {/* 내종목 버튼 */}
            <Button
              variant="warning"
              onClick={handleTestFavorites}
              disabled={isBasicMember}
              title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
            >
              내종목
            </Button>

            <Button
              variant="info"
              onClick={handleTodayAiClick}
              disabled={isBasicMember}
              title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
            >
              Today AI
            </Button>

            {/* 검색창과 검색버튼 */}
            <div className="input-group" style={{ width: '200px' }}>
              <Form.Control
                type="text"
                placeholder="종목명 또는 코드"
                value={searchInput}
                className="bg-transparent"
                style={{
                  borderColor: 'var(--bs-border-color)',
                  color: 'var(--bs-body-color)',
                  backgroundColor: 'var(--bs-body-bg)',
                }}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchByText();
                  }
                }}
                disabled={isBasicMember}
              />
              <Button
                variant="outline-secondary"
                onClick={handleSearchByText}
                disabled={isLoading || isBasicMember}
                className="bg-transparent"
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                종목검색
              </Button>
            </div>
          </div>
          <Button
            variant="link"
            onClick={handleToggle}
            className="p-0"
            style={{ color: 'var(--bs-body-color)' }}
          >
            {isOpen ? '접기' : '펼치기'}
          </Button>
        </div>

        {/* Opinion 섹션 수정 */}
        <div
          className="px-4 py-3 mt-2"
          style={{
            borderTop: '2px solid var(--bs-primary)',
            backgroundColor: 'var(--bs-body-bg)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div className="d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2">
                <strong className="text-primary fs-5">
                  지수로 보는 AI 투자의견:
                </strong>
                <span className="fs-5 fw-bold" style={{ color: '#dc3545' }}>
                  {opinion?.opinion || '로딩중...'}
                </span>
              </div>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowOpinionDetail(!showOpinionDetail)}
                style={{ minWidth: '80px' }}
              >
                {showOpinionDetail ? '접기 ▼' : '펼치기 ▲'}
              </Button>
            </div>

            <div
              style={{
                maxHeight: showOpinionDetail ? '500px' : '0',
                opacity: showOpinionDetail ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                marginTop: showOpinionDetail ? '1rem' : '0',
              }}
            >
              <div>
                <strong className="text-primary d-block mb-2">
                  분석에 대한 설명:
                </strong>
                <p className="mb-3" style={{ lineHeight: '1.6' }}>
                  {opinion?.reason || '로딩중...'}
                </p>
              </div>
              <div className="text-muted d-flex gap-2 align-items-center">
                <strong>분석엔진:</strong>
                <span className="badge bg-secondary">
                  {opinion?.ai_method?.toUpperCase() || '로딩중...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Form>
    </Container>
  );
}

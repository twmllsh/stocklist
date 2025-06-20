import {
  Form,
  Row,
  Col,
  Button,
  Container,
  OverlayTrigger,
  Tooltip,
  Alert,
  Badge, // Badge 추가
} from 'react-bootstrap';
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFilteredStocks,
  selectSearchCount,
  selectFilteredStocks, // 새로 추가: 검색 결과 선택자 import
} from '../../store/slices/stockSlice'; // 수정된 임포트
import { stockService } from '../../services/stockService'; // 상단에 추가
import { selectUser } from '../../store/slices/authSlice';
import StockAiToday from './StockAiToday'; // 상단에 추가
import AIOpinion from './AIOpinion'; // AIOpinion 컴포넌트 import 추가

// 초기 필터 상태를 상수로 정의
const INITIAL_FILTERS = {
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
  exp: false, // EXP를 boolean으로 변경
  exp_value: 0.1, // 별도 값으로 관리
  good_cash: true, // 유보율 버튼 추가
  good_cash_value: 500, // 유보율 기본값 설정
};

export default function Filter({ onToggle }) {
  const user = useSelector(selectUser);
  const isBasicMember = user?.membership === 'ASSOCIATE';

  const dispatch = useDispatch();
  const searchCount = useSelector(selectSearchCount);
  const filteredStocks = useSelector(selectFilteredStocks); // 검색 결과 가져오기
  const [isOpen, setIsOpen] = useState(true);
  const [manualClose, setManualClose] = useState(false); // 수동으로 접었는지 여부
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [resultCount, setResultCount] = useState(undefined);
  const [hasResults, setHasResults] = useState(false);
  const [searchInput, setSearchInput] = useState(''); // 검색어 입력 상태 추가
  const [opinion, setOpinion] = useState(''); // 추가
  const [showOpinionDetail, setShowOpinionDetail] = useState(false); // 기본값을 false로 설정
  const [autoCollapse, setAutoCollapse] = useState(true); // 자동접힘 옵션 상태 추가
  const [noResultsMessage, setNoResultsMessage] = useState(''); // 결과 없음 메시지 상태 추가

  // 준회원 알림 메시지 컴포넌트 정의
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

  // 초기 필터 상태 참조를 위해 상수 사용
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  // 필터 초기화 함수
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearchInput(''); // 검색어도 초기화
  };

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
        { name: 'good_cash', label: '유보율', hasValue: true }, // 유보율 버튼 추가
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
        { name: 'new_listing', label: '신규상장' }, // 신규상장 버튼을 그룹 4로 이동
      ],
    },
    {
      title: 'etc..',
      buttons: [
        // 신규상장 버튼 제거
        {
          name: 'exp',
          label: 'EXP',
          hasValue: true, // 값을 받는 형식으로 변경
          valueType: 'float', // float 타입으로 설정
        },
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

          // 그룹 3, 4 버튼들 비활성화 코드 제거함
          // 모든 버튼이 독립적으로 토글되도록 변경
        }
      } else {
        // 버튼이 비활성화되는 경우
        // 그룹 5 버튼들이 모두 비활성화되었는지 확인
        const isAllGroup5Inactive = group5Buttons.every((btn) =>
          btn === name ? !newValue : !newFilters[btn]
        );

        if (isAllGroup5Inactive && previousStateRef.current.group3and4) {
          // 이전 상태 복원 코드 제거
          // 모든 버튼이 독립적으로 유지되도록 변경
        }
      }

      return newFilters;
    });
  }, []); // 의존성 없음

  const handleSearch = async () => {
    try {
      setNoResultsMessage(''); // 검색 시작 시 메시지 초기화

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
          } else if (key === 'good_cash') {
            searchFilters[key] = filters.good_cash_value;
          } else if (key === 'exp') {
            searchFilters[key] = filters.exp_value;
          } else {
            searchFilters[key] = true;
          }
        }
      });

      //  요청 URL 로깅
      const queryString = new URLSearchParams(searchFilters).toString();
      // process.env 대신 import.meta.env 사용
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${apiBaseUrl}/api/stocklist/?${queryString}`;
      // console.log('검색 요청 URL:', fullUrl);
      // console.log('검색 파라미터:', searchFilters);

      const result = await dispatch(
        fetchFilteredStocks(searchFilters)
      ).unwrap();

      // 검색 결과가 없는 경우 메시지 설정
      if (result && Array.isArray(result) && result.length === 0) {
        setNoResultsMessage(
          '검색 결과가 없습니다. 영문이 포함되었다면 대소문자구분을 확인하세요'
        );
      }
    } catch (error) {
      console.error('Search error:', error);
      setNoResultsMessage('검색 중 오류가 발생했습니다');
    }
  };

  // 즐겨찾기 조회 핸들러 수정
  const handleTestFavorites = async () => {
    try {
      setIsLoading(true);
      setNoResultsMessage(''); // 검색 시작 시 메시지 초기화

      const favoritesFilter = {
        favorites: 'true',
      };

      // process.env 대신 import.meta.env 사용
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${apiBaseUrl}/api/stocklist/?favorites=true`;
      // console.log('내종목 요청 URL:', fullUrl);
      // console.log('내종목 요청 파라미터:', favoritesFilter);

      const result = await dispatch(
        fetchFilteredStocks(favoritesFilter)
      ).unwrap();

      // 응답 데이터 디버깅 및 검사
      // console.log('즐겨찾기 응답 데이터:', result);

      if (Array.isArray(result)) {
        // 응답이 배열인지 확인
        result.forEach((item, index) => {
          if (item.code === true) {
            // 잘못된 code 값이 있으면 고유 식별자로 수정
            console.warn(
              `즐겨찾기 항목 #${index}에 잘못된 코드 값이 있습니다. 수정합니다.`
            );
            item.code = `favorite-${index}`;
          }
        });
      }

      // 검색 결과가 없는 경우 메시지 설정
      if (result && Array.isArray(result) && result.length === 0) {
        setNoResultsMessage('즐겨찾기한 종목이 없습니다');
      }

      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error('[Filter] 즐겨찾기 요청 실패:', error);
      setNoResultsMessage('즐겨찾기 목록을 불러오는 중 오류가 발생했습니다');
    }
  };

  // Today AI 버튼 클릭 핸들러 단순화
  const handleTodayAiClick = async (days = 4) => {
    try {
      setNoResultsMessage(''); // 검색 시작 시 메시지 초기화
      const params = { today_ai: days };
      const queryString = new URLSearchParams(params).toString();

      // process.env 대신 import.meta.env 사용
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${apiBaseUrl}/api/stocklist/?${queryString}`;
      // console.log(`오늘AI(${days}일) 요청 URL:`, fullUrl);
      // console.log('AI 요청 파라미터:', params);

      const result = await dispatch(fetchFilteredStocks(params)).unwrap();

      // 검색 결과가 없는 경우 메시지 설정
      if (result && Array.isArray(result) && result.length === 0) {
        setNoResultsMessage(
          `AI 분석 종목이 ${days === 1 ? '오늘' : `최근 ${days}일간`} 없습니다`
        );
      }
    } catch (error) {
      console.error('Today AI 데이터 로드 실패:', error);
      setNoResultsMessage('AI 분석 종목을 불러오는 중 오류가 발생했습니다');
    }
  };

  // 스크롤 방향 감지 및 필터 접기 처리 수정
  useEffect(() => {
    let lastScrollY = window.pageYOffset;

    const handleScroll = () => {
      if (!autoCollapse) return; // 자동접힘 옵션이 꺼져있으면 무시

      const currentScrollY = window.pageYOffset;
      const scrollingUp = currentScrollY < lastScrollY;

      if (scrollingUp && isOpen) {
        setIsOpen(false);
        setManualClose(true);
        onToggle(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen, onToggle, autoCollapse]); // autoCollapse 의존성 추가

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
      setNoResultsMessage(''); // 검색 시작 시 메시지 초기화

      const updatedFilters = {
        search: searchInput.trim(), // 검색 시에는 다른 필터 제외하고 search만 전송
      };

      // process.env 대신 import.meta.env 사용
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const fullUrl = `${apiBaseUrl}/api/stocklist/?search=${encodeURIComponent(
        searchInput.trim()
      )}`;
      // console.log('종목검색 요청 URL:', fullUrl);
      // console.log('종목검색 요청 파라미터:', updatedFilters);

      const result = await dispatch(
        fetchFilteredStocks(updatedFilters)
      ).unwrap();

      // 검색 결과가 없는 경우 메시지 설정
      if (result && Array.isArray(result) && result.length === 0) {
        setNoResultsMessage(`'${searchInput.trim()}' 검색 결과가 없습니다`);
      }
    } catch (error) {
      console.error('Search by text failed:', error);
      setNoResultsMessage('검색 중 오류가 발생했습니다');
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

  // Redux 저장소의 검색 결과 변경 감지
  useEffect(() => {
    // 검색 결과가 없고, 이전에 검색을 수행했으며, 에러 메시지가 설정되지 않은 경우
    if (
      filteredStocks &&
      filteredStocks.length === 0 &&
      searchCount === 0 &&
      !noResultsMessage
    ) {
      setNoResultsMessage('검색 결과가 없습니다');
    } else if (filteredStocks && filteredStocks.length > 0) {
      // 검색 결과가 있으면 메시지 초기화
      setNoResultsMessage('');
    }
  }, [filteredStocks, searchCount, noResultsMessage]);

  // 메시지 전달을 위한 이벤트 발생 - 부모 컴포넌트에 상태 전달
  useEffect(() => {
    // noResultsMessage가 변경될 때마다 이벤트 발생
    const event = new CustomEvent('searchResultsMessage', {
      detail: { message: noResultsMessage },
    });
    document.dispatchEvent(event);
  }, [noResultsMessage]);

  // 버튼 렌더링 함수 수정
  const renderButton = (btn, index) => {
    // index 매개변수 추가
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // 버튼 비활성화 조건 제거
    const isDisabled = false;

    // float 타입 처리 수정
    if (btn.hasValue && btn.valueType === 'float') {
      return (
        <div key={index} className="d-inline-flex align-items-center me-2 mb-2">
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>{filterDescriptions[btn.name]}</Tooltip>}
          >
            <Button
              variant={filters[btn.name] ? 'success' : `outline-success`}
              size="sm"
              onClick={() => handleFilterChange(btn.name, !filters[btn.name])}
              className="me-1"
            >
              {btn.label}
            </Button>
          </OverlayTrigger>
          {filters[btn.name] && (
            <div className="d-flex align-items-center">
              <Form.Control
                size="sm"
                type="number"
                step="0.01"
                value={filters[`${btn.name}_value`]}
                onChange={(e) =>
                  handleFilterChange(
                    `${btn.name}_value`,
                    parseFloat(e.target.value)
                  )
                }
                style={{ width: '60px', height: '31px' }}
                className="ms-1"
              />
              <small className="ms-1 text-muted">이상</small>
            </div>
          )}
        </div>
      );
    }

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
            onClick={() => handleFilterChange(btn.name)}
            variant="success"
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
                onClick={() => handleFilterChange(btn.name)}
                variant="success"
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
            <div className="d-flex align-items-center">
              <Form.Control
                type="number"
                size="sm"
                style={{ width: '70px' }}
                value={filters[`${btn.name}_value`] || ''}
                onChange={(e) =>
                  handleFilterChange(`${btn.name}_value`, e.target.value)
                }
              />
              <small className="ms-1 text-muted">
                {/* 버튼 종류에 따라 단위 텍스트 추가 */}
                {btn.name === 'consen' || btn.name === 'good_cash'
                  ? '% 이상'
                  : btn.name === 'sun_ac' || btn.name === 'coke_up'
                  ? '% 이하'
                  : ''}
              </small>
            </div>
          ))}
      </div>
    );
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
      {/* 자동접힘 옵션 토글 버튼 수정 */}
      <div
        className="d-flex align-items-center justify-content-end px-1"
        style={{
          borderBottom: '1px solid var(--bs-border-color)',
          backgroundColor: 'var(--bs-body-bg)',
          height: '24px', // 높이 고정
        }}
      >
        <div className="d-flex align-items-center">
          <small
            className="text-muted me-1"
            style={{
              fontSize: '0.7rem',
              lineHeight: 1,
            }}
          >
            자동접힘
          </small>
          <Form.Check
            type="switch"
            id="auto-collapse-switch"
            checked={autoCollapse}
            onChange={(e) => setAutoCollapse(e.target.checked)}
            className="mt-0"
            style={{
              transform: 'scale(0.8)',
              marginBottom: 0,
            }}
          />
        </div>
      </div>

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
                <div className="d-flex align-items-center mb-2">
                  <h6 className="mb-0 me-auto">{group.title}</h6>
                  {/* 첫 번째 그룹에 초기화 버튼 추가 */}
                  {groupIdx === 0 && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="ms-2 py-0 px-2"
                      onClick={handleResetFilters}
                      disabled={isBasicMember}
                      title={
                        isBasicMember
                          ? '정회원 이상 전용 기능입니다'
                          : '필터 초기화'
                      }
                      style={{ fontSize: '0.75rem' }}
                    >
                      초기화
                    </Button>
                  )}
                </div>
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

          {/* AIOpinion 컴포넌트 추가 */}
          <div className="mt-3">
            <AIOpinion />
          </div>
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
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* 검색창과 검색버튼 */}
            <div
              className="input-group input-group-sm"
              style={{ width: '140px' }}
            >
              <Form.Control
                type="text"
                size="sm"
                placeholder="종목명/코드"
                value={searchInput}
                className="bg-transparent"
                style={{
                  borderColor: 'var(--bs-border-color)',
                  color: 'var(--bs-body-color)',
                  backgroundColor: 'var(--bs-body-bg)',
                  fontSize: '0.875rem',
                  height: '31px',
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
                size="sm"
                onClick={handleSearchByText}
                disabled={isLoading || isBasicMember}
                className="bg-transparent d-flex align-items-center"
                style={{ height: '31px' }}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                검색
              </Button>
            </div>

            {/* 초기화 버튼 제거 - 상단으로 이동 */}

            {/* 버튼 그룹 */}
            <div className="d-flex gap-2">
              <Button
                variant="outline-warning"
                size="sm"
                className="py-1 px-2"
                onClick={handleTestFavorites}
                disabled={isBasicMember}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                내종목
              </Button>

              <Button
                variant="outline-info"
                size="sm"
                className="py-1 px-2"
                onClick={() => handleTodayAiClick(4)}
                disabled={isBasicMember}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                최근4일간AI
              </Button>

              <Button
                variant="outline-info"
                size="sm"
                className="py-1 px-2"
                onClick={() => handleTodayAiClick(1)}
                disabled={isBasicMember}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                오늘AI
              </Button>
            </div>

            {/* 조건검색 버튼 */}
            <div className="d-flex align-items-center">
              <Button
                variant="success"
                size="sm"
                className="py-1 px-3"
                onClick={handleSearch}
                disabled={isLoading || isBasicMember}
                title={isBasicMember ? '정회원 이상 전용 기능입니다' : ''}
              >
                {isLoading ? (
                  <span className="d-flex align-items-center gap-1">
                    <span className="spinner-border spinner-border-sm" />
                    검색
                  </span>
                ) : (
                  '검색'
                )}
              </Button>
              {searchCount !== undefined && (
                <Badge
                  bg="secondary"
                  className="ms-1"
                  style={{ fontSize: '0.75rem' }}
                >
                  {searchCount}
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="link"
            onClick={handleToggle}
            className="p-0 ms-2"
            style={{ color: 'var(--bs-body-color)' }}
          >
            {isOpen ? '접기' : '펼치기'}
          </Button>
        </div>
      </Form>
    </Container>
  );
}

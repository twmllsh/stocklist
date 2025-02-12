import { Form, Row, Col, Button, Container } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchFilteredStocks } from '../../store/slices/stockSlice'; // 수정된 임포트

export default function Filter({ onToggle }) {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(true);
  const [manualClose, setManualClose] = useState(false); // 수동으로 접었는지 여부
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [resultCount, setResultCount] = useState(undefined);
  const [hasResults, setHasResults] = useState(false);

  const [filters, setFilters] = useState({
    change: true,
    change_min: 2,
    change_max: 10,
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
          label: '등락율',
          hasValue: true,
          hasRangeValue: true, // 범위 값 표시를 위한 새 속성
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
      await dispatch(fetchFilteredStocks(filters));
    } catch (error) {
      console.error('Search error:', error);
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
                  {group.buttons.map((btn) => (
                    <div key={btn.name} className="d-flex align-items-center">
                      <Button
                        variant={
                          filters[btn.name] ? 'primary' : 'outline-primary'
                        }
                        size="sm"
                        onClick={() => handleFilterChange(btn.name)}
                        className="me-2"
                      >
                        {btn.label}
                      </Button>
                      {btn.hasValue && btn.hasRangeValue ? (
                        <div className="d-flex align-items-center gap-1">
                          <Form.Control
                            type="number"
                            size="sm"
                            style={{ width: '70px' }}
                            placeholder="최소"
                            value={filters.change_min || ''}
                            onChange={(e) =>
                              handleFilterChange('change_min', e.target.value)
                            }
                          />
                          <span>~</span>
                          <Form.Control
                            type="number"
                            size="sm"
                            style={{ width: '70px' }}
                            placeholder="최대"
                            value={filters.change_max || ''}
                            onChange={(e) =>
                              handleFilterChange('change_max', e.target.value)
                            }
                          />
                        </div>
                      ) : (
                        btn.hasValue && (
                          <Form.Control
                            type="number"
                            size="sm"
                            style={{ width: '70px' }}
                            value={filters[`${btn.name}_value`] || ''}
                            onChange={(e) =>
                              handleFilterChange(
                                `${btn.name}_value`,
                                e.target.value
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {idx === 0 && <hr className="my-3" />}{' '}
              {/* 첫 번째 그룹 다음에 구분선 추가 */}
            </div>
          ))}
        </div>

        <div className="d-flex justify-content-between align-items-center py-2 sticky-bottom bg-white">
          <div className="d-flex align-items-center">
            <Button
              variant="outline-danger px-5"
              onClick={handleSearch}
              disabled={isLoading}
            >
              {isLoading ? '검색 중...' : '검색'}
            </Button>
            <span className="text-secondary me-2">
              {resultCount !== undefined && `${resultCount}개 종목`}
            </span>
            {error && <span className="text-danger">{error}</span>}
          </div>
          <Button variant="link" onClick={handleToggle} className="p-0">
            {isOpen ? '접기' : '펼치기'}
          </Button>
        </div>
      </Form>
    </Container>
  );
}

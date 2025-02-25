import React, { useState, useEffect } from 'react';
import { Card } from 'react-bootstrap';
import './styles/stockCard.css';

const StockCard = ({ stock, onClick }) => {
  const formatNumber = (num) => {
    if (!num) return '-';
    return num.toLocaleString();
  };

  const getPriceColor = (value) => {
    if (value > 0) return 'text-danger';
    if (value < 0) return 'text-primary';
    return 'text-muted';
  };

  const formatValue = (value) => {
    if (
      value === 'N/A' ||
      value === undefined ||
      value === null ||
      value === ''
    )
      return '-';
    return value;
  };

  const getVol20Ratio = () => {
    const ratio = ((stock.거래량 / stock.vol20) * 100).toFixed(1);
    return parseFloat(ratio);
  };

  const isHighVolume = getVol20Ratio() > 200;

  const getVolumeRatio = () => {
    const ratio = stock.매도총잔량 / stock.매수총잔량;
    return isNaN(ratio) ? '-' : ratio.toFixed(1);
  };

  const isHighVolumeRatio = () => {
    const ratio = parseFloat(getVolumeRatio());
    return !isNaN(ratio) && ratio > 2;
  };

  const getGrowthLevel = () => {
    const growth1 = parseFloat(stock.growth_y1);
    const growth2 = parseFloat(stock.growth_y2);
    const growthQ = parseFloat(stock.growth_q);

    if (growth1 >= 50 || growth1 <= -1000) {
      if ((growth2 >= 20 && growthQ >= 20) || growthQ <= -1000) {
        return 3; // 3단계: (이번성장률 조건 + 다음성장률 20% 이상 + YoY 20% 이상) 또는 YoY가 -1000 이하
      }
      if (growth2 >= 20) {
        return 2; // 2단계: 이번성장률 조건 + 다음성장률 20% 이상
      }
      return 1; // 1단계: 이번성장률 조건만 만족
    }
    return 0; // 기본
  };

  // 성장률 표시를 위한 새로운 함수 추가
  const formatGrowthValue = (value) => {
    if (
      value === 'N/A' ||
      value === undefined ||
      value === null ||
      value === ''
    )
      return '-';
    const numValue = parseFloat(value);
    if (numValue === -10000) return '적자';
    if (numValue === -1000) return '턴어라운드';
    return `${value}%`;
  };

  const growthLevel = getGrowthLevel();

  const isGoodFinancial = () => {
    const eps = parseFloat(stock.EPS);
    const reserveRatio = parseFloat(stock.유보율);
    return eps > 0 && reserveRatio >= 1000;
  };

  // formatDate 함수 수정
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // ISO 형식이나 PostgreSQL timestamptz 형식 모두 처리
      const date = new Date(dateString.replace(' ', 'T'));

      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return '-';
      }

      // MM/DD 형식으로 반환
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date
        .getDate()
        .toString()
        .padStart(2, '0')}`;
    } catch (error) {
      console.error('Date parsing error:', error);
      return '-';
    }
  };

  const formatFinancialValue = (value, postfix = '') => {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'N/A' ||
      isNaN(Number(value))
    ) {
      return '-';
    }
    try {
      const numValue = Number(value);
      return `${numValue.toFixed(1)}${postfix}`;
    } catch {
      return '-';
    }
  };

  return (
    <Card className="stock-card hover-effect mb-0 px-1 py-1" onClick={onClick}>
      <Card.Body className="p-1 mx-1 my-2">
        {' '}
        {/* padding 축소 */}
        {/* 종목 정보 헤더 */}
        <div className="bg-light py-1 px-2 border-bottom">
          {' '}
          {/* padding 축소 */}
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 text-primary fw-bold">{stock.종목명}</h5>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                ({stock.code})
              </small>
            </div>
            <div className="text-end">
              <div
                className={`fw-bold ${getPriceColor(stock.등락률)}`}
                style={{ fontSize: '0.9rem' }}
              >
                {formatNumber(stock.현재가)}
              </div>
              <small
                className={`${getPriceColor(stock.등락률)}`}
                style={{ fontSize: '0.75rem' }}
              >
                {stock.등락률 > 0 ? '▲' : stock.등락률 < 0 ? '▼' : '-'}
                {Math.abs(stock.등락률).toFixed(1)}%
              </small>
            </div>
          </div>
        </div>
        <div className="d-flex flex-column" style={{ gap: '1px' }}>
          {/* 거래량 섹션 */}
          <div
            className={`py-1 px-2 border-bottom ${
              isHighVolume ? 'high-volume' : ''
            }`}
          >
            <div className="row g-2">
              <div className="col-6">
                <div className="data-label">거래량</div>
                <div
                  className={`data-value ${
                    isHighVolume ? 'text-danger fw-bold' : ''
                  }`}
                >
                  {formatNumber(stock.거래량)}
                </div>
              </div>
              <div className="col-6">
                <div className="data-label">VOL/20</div>
                <div
                  className={`data-value ${
                    isHighVolume ? 'text-danger fw-bold' : ''
                  }`}
                >
                  {getVol20Ratio()}%
                </div>
              </div>
            </div>
          </div>
          {/* 매수/매도 섹션 수정 */}
          <div
            className={`py-1 px-2 border-bottom ${
              isHighVolumeRatio() ? 'high-ratio' : ''
            }`}
          >
            <div className="d-flex justify-content-between mb-2">
              <div className="text-center flex-grow-1">
                <div className="data-label">매도잔량</div>
                <div
                  className={`data-value text-danger ${
                    isHighVolumeRatio() ? 'fs-5' : ''
                  }`}
                >
                  {formatNumber(stock.매도총잔량)}
                </div>
              </div>
              <div className="text-center flex-grow-1">
                <div className="data-label">잔량비</div>
                <div
                  className={`data-value ${
                    isHighVolumeRatio()
                      ? 'text-warning fs-5 fw-bold'
                      : 'fw-bold'
                  }`}
                >
                  {getVolumeRatio()}
                </div>
              </div>
              <div className="text-center flex-grow-1">
                <div className="data-label">매수잔량</div>
                <div
                  className={`data-value text-primary ${
                    isHighVolumeRatio() ? 'fs-5' : ''
                  }`}
                >
                  {formatNumber(stock.매수총잔량)}
                </div>
              </div>
            </div>
          </div>
          {/* 성장률 섹션 수정 */}
          <div
            className={`py-2 px-3 border-bottom ${
              growthLevel === 3
                ? 'growth-level-3'
                : growthLevel === 2
                ? 'growth-level-2'
                : growthLevel === 1
                ? 'growth-level-1'
                : ''
            }`}
          >
            <div className="row g-2">
              <div className="col-4">
                <div className="data-label">이번성장률</div>
                <div
                  className={`data-value ${
                    growthLevel > 0 ? 'text-success fw-bold' : ''
                  }`}
                >
                  {formatGrowthValue(stock.growth_y1)}
                </div>
              </div>
              <div className="col-4">
                <div className="data-label">다음성장률</div>
                <div
                  className={`data-value ${
                    growthLevel >= 2 ? 'text-success fw-bold' : ''
                  }`}
                >
                  {formatGrowthValue(stock.growth_y2)}
                </div>
              </div>
              <div className="col-4">
                <div className="data-label">YoY</div>
                <div
                  className={`data-value ${
                    growthLevel === 3 ? 'text-success fw-bold' : ''
                  }`}
                >
                  {formatGrowthValue(stock.growth_q)}
                </div>
              </div>
            </div>
          </div>
          {/* 재무정보 표시 */}
          {/* 재무 정보 섹션 */}
          <div className="py-1 px-2">
            <div className="row g-2">
              <div className="col-4">
                <div className="data-label">EPS</div>
                <div
                  className={`data-value ${
                    isGoodFinancial() ? 'text-primary fw-bold' : ''
                  }`}
                >
                  {formatValue(stock.EPS)}
                </div>
              </div>
              <div className="col-4">
                <div className="data-label">유보율</div>
                <div className="data-value">
                  {formatFinancialValue(stock.유보율, '%')}
                </div>
              </div>
              <div className="col-4">
                <div className="data-label">부채율</div>
                <div className="data-value">
                  {formatValue(stock.부채비율?.toFixed(1))}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StockCard;

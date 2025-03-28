import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner } from 'react-bootstrap';
import { stockService } from '../../services/stockService';

const AIOpinion = () => {
  const [opinions, setOpinions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 의견 상태에 따른 배지 색상 설정
  const getBadgeVariant = (opinion) => {
    switch (opinion?.toLowerCase()) {
      case '매수':
        return 'danger';
      case '매도':
        return 'primary';
      case '관망':
        return 'success';
      case '보류':
        return 'success';
      default:
        return 'info';
    }
  };

  // 날짜 포맷 헬퍼 함수
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    const fetchAIOpinions = async () => {
      try {
        setLoading(true);
        // 기존에 정의된 getOpinionForStockToday 함수 사용
        const response = await stockService.getOpinionForStockToday();

        // 응답이 배열이 아니면 배열로 변환 (단일 객체인 경우)
        const opinionsList = Array.isArray(response) ? response : [response];

        setOpinions(opinionsList);
        setLoading(false);
      } catch (err) {
        console.error('AI 의견 불러오기 실패:', err);
        setError('AI 의견을 불러오는 중 오류가 발생했습니다');
        setLoading(false);
      }
    };

    fetchAIOpinions();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner animation="border" variant="primary" size="sm" />
        <span className="ms-2">AI 의견 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-danger py-2">{error}</div>;
  }

  return (
    <div className="ai-opinion-container mb-3">
      <h6 className="border-bottom pb-2 mb-2 d-flex align-items-center">
        <i className="bi bi-robot me-2"></i>
        AI로 보는 kodex 레버리지(122630) 분석
      </h6>

      {/* 스크롤 가능한 컨테이너 추가 */}
      <div
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          paddingRight: '5px',
        }}
        className="custom-scrollbar"
      >
        {opinions.length > 0 ? (
          opinions.map((opinion, index) => (
            <Card key={index} className="mb-2 shadow-sm">
              <Card.Body className="p-3">
                <div className="d-flex justify-content-between mb-2">
                  <Badge
                    bg={getBadgeVariant(opinion.opinion)}
                    className="px-3 py-2"
                  >
                    {opinion.opinion || '분석 중'}
                  </Badge>
                  <small className="text-muted">
                    {formatDate(opinion.created_at)}
                  </small>
                </div>
                <Card.Text style={{ fontSize: '0.9rem' }}>
                  {opinion.reason || '분석 내용이 없습니다.'}
                </Card.Text>
                {opinion.ai_method && (
                  <div className="text-end mt-2">
                    <small className="text-muted fst-italic">
                      분석: {opinion.ai_method}
                    </small>
                  </div>
                )}
              </Card.Body>
            </Card>
          ))
        ) : (
          <div className="text-center py-3 text-muted">
            최근 AI 분석 의견이 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

export default AIOpinion;

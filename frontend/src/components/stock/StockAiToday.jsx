import React from 'react';
import { Modal, Table, Badge, Spinner, Alert } from 'react-bootstrap';

const StockAiToday = ({ show, onHide, data }) => {
  const getOpinionColor = (opinion) => {
    switch (opinion) {
      case '매수':
        return 'danger';
      case '매도':
        return 'primary';
      case '보류':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  if (!data) {
    return (
      <Modal show={show} onHide={onHide} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>오늘의 AI 분석</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-5">
          <Spinner animation="border" variant="primary" />
        </Modal.Body>
      </Modal>
    );
  }

  if (data.error) {
    return (
      <Modal show={show} onHide={onHide}>
        <Modal.Header closeButton>
          <Modal.Title>오늘의 AI 분석</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">데이터를 불러오는데 실패했습니다.</Alert>
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>오늘의 AI 분석</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table hover>
          <thead>
            <tr>
              <th>종목</th>
              <th>의견</th>
              <th>분석사유</th>
              <th>분석엔진</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.ticker.name}</td>
                <td>
                  <Badge bg={getOpinionColor(item.opinion)}>
                    {item.opinion}
                  </Badge>
                </td>
                <td>
                  <div style={{ maxWidth: '400px' }}>{item.reason}</div>
                </td>
                <td>{item.ai_method.toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
};

export default StockAiToday;

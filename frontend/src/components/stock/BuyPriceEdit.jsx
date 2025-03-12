import React, { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { stockService } from '../../services/stockService';

const BuyPriceEdit = ({ show, onHide, ticker, currentPrice, onUpdate }) => {
  const [buyPrice, setBuyPrice] = useState(currentPrice || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await stockService.updateBuyPrice(ticker, Number(buyPrice));
      onUpdate(Number(buyPrice));
      onHide();
    } catch (error) {
      console.error('매수가격 수정 실패:', error);
      alert('매수가격 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>매수가격 수정</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group>
            <Form.Label>매수가격</Form.Label>
            <Form.Control
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              required
            />
          </Form.Group>
          <Button
            variant="primary"
            type="submit"
            className="mt-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default BuyPriceEdit;

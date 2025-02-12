export const getPriceColor = (value) => {
  if (!value) return '';
  const numValue = parseFloat(value);
  return numValue > 0
    ? 'text-danger'
    : numValue < 0
    ? 'text-primary'
    : 'text-muted';
};

export const formatNumber = (num) => {
  if (!num) return '-';
  return num.toLocaleString();
};

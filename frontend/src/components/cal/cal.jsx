// n일 이동평균선 계산 함수
export const calculateMA = (data, period) => {
  return data.map((_, index) => {
    if (index < period - 1) return null;
    const slice = data.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, value) => acc + value.close, 0);
    return sum / period;
  });
};

// n기간 볼린저 밴드 계산 함수 수정
export const calculateBB = (data, period) => {
  const multiplier = 2;

  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);

    // 중간값(MA) 계산
    const prices = slice.map((item) => Number(item.close));
    const ma = prices.reduce((sum, price) => sum + price, 0) / period;

    // 표준편차 계산
    const squaredDiffs = prices.map((price) => Math.pow(price - ma, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      middle: ma,
      upper: ma + multiplier * stdDev,
      lower: ma - multiplier * stdDev,
      time: data[i].time,
    });
  }

  return result;
};

// 사용 예시:
/*
  const maData = calculateMA(chartData, 20);  // 20일 이동평균
  const bbData = calculateBB(chartData, 20);  // 20일 볼린저밴드
  
  bbData.map(bb => {
    if (bb) {
      console.log(`
        중심선: ${bb.middle}
        상단: ${bb.upper}
        하단: ${bb.lower}
      `);
    }
  });
  */

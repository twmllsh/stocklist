import axios from 'axios'; // axios import 추가

// convertToDate 함수 추가
function convertToDate(dateStr) {
  if (dateStr.length === 8) {
    // YYYYMMDD 형식
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(
      6,
      8
    )}`;
  } else {
    // YYYYMMDDHHmm 형식
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(
      6,
      8
    )} ${dateStr.slice(8, 10)}:${dateStr.slice(10, 12)}`;
  }
}

async function fetchOhlcvData(code, candleType) {
  let period = 120;
  if (candleType === 'day') {
    period = 100; // 기간 조정
  }

  const today = new Date();
  const startdate = new Date();
  // 오늘로부터 미래 날짜가 아닌 과거 날짜로 설정
  startdate.setDate(today.getDate() - period);

  // 날짜 형식을 YYYYMMDD로 통일
  const startDateTime = `${startdate.getFullYear()}${String(
    startdate.getMonth() + 1
  ).padStart(2, '0')}${String(startdate.getDate()).padStart(2, '0')}0000`;

  const endDateTime = `${today.getFullYear()}${String(
    today.getMonth() + 1
  ).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}${String(
    today.getHours()
  ).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;

  // baseUrl을 chart/로 시작하도록 수정
  const baseUrl = '/api/chart/chart/domestic/item/'; // URL 수정
  let url = ''; // url 변수를 먼저 선언

  if (candleType === 'day') {
    url = `${baseUrl}${code}/day?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
  } else if (candleType === '30') {
    url = `${baseUrl}${code}/minute30?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
  } else if (candleType === '5') {
    url = `${baseUrl}${code}/minute5?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
  } else {
    url = `${baseUrl}${code}/day?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
  }

  console.log('Request URL:', url); // URL 확인

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        // 브라우저에서 설정할 수 없는 헤더 제거
      },
    });
    console.log('Raw response:', response.data); // 원본 응답 데이터 확인

    const transformedData = response.data.map((item) => {
      console.log('Raw item:', item); // 원본 데이터 아이템 확인

      const [year, month, day] = item.localDate
        ? [
            item.localDate.slice(0, 4),
            item.localDate.slice(4, 6),
            item.localDate.slice(6, 8),
          ]
        : item.localDateTime.split(' ')[0].split('-');

      const timestamp =
        new Date(
          Date.UTC(Number(year), Number(month) - 1, Number(day))
        ).getTime() / 1000;

      const dataPoint = {
        time: timestamp,
        open: Number(item.openPrice),
        high: Number(item.highPrice),
        low: Number(item.lowPrice),
        close:
          candleType === 'day'
            ? Number(item.closePrice)
            : Number(item.currentPrice),
      };

      console.log('Transformed item:', dataPoint); // 변환된 데이터 아이템 확인
      return dataPoint;
    });

    console.log('Transformed data with timestamp:', transformedData); // 디버깅용
    return transformedData;
  } catch (error) {
    if (error.response) {
      // 서버가 2xx 외의 상태 코드를 반환한 경우
      console.error('Error response:', error.response.data);
      console.error('Error status:', error.response.status);
    } else if (error.request) {
      // 요청이 전송되었으나 응답을 받지 못한 경우
      console.error('Error request:', error.request);
    } else {
      // 요청 설정 중 오류가 발생한 경우
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

// const testFetch = async () => {
//   try {
//     // // Fetch 방식
//     // const dataFromFetch = await fetchDataWithFetch('005930');
//     // console.log('Fetch result:', dataFromFetch);

//     // Axios 방식
//     const dataFromAxios = await fetchOhlcvData('005930', '5');
//     console.log('Axios result:', dataFromAxios);
//   } catch (error) {
//     console.error('Error:', error);
//   }
// };
// testFetch();
export default fetchOhlcvData;

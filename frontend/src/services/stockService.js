import stockAxios from './config/stockAxios';

// // AI 의견 가져오기 함수 추가
// const getAIOpinions = () => {
//   return stockAxios.get('/ai-opinion/');
// };

export const stockService = {
  getFilteredStocks: async (filters) => {
    try {
      // 필터 객체를 URLSearchParams로 직접 변환
      const queryString = new URLSearchParams();

      // 필터 처리
      Object.entries(filters).forEach(([key, value]) => {
        // undefined나 null이 아닌 경우에만 파라미터 추가
        if (value !== undefined && value !== null) {
          queryString.append(key, value);
        }
      });

      const url = `/stocklist/?${queryString.toString()}`;
      // console.log('Filtered stock URL:', url);
      const response = await stockAxios.get(url);
      return response.data;
    } catch (error) {
      console.error('API 요청 실패:', error);
      throw error;
    }
  },

  // 종목 뉴스 조회
  getStockNews: async (code) => {
    try {
      const response = await stockAxios.get('/news/', {
        params: { ticker: code },
      });
      // response.data가 배열인지 확인하고 반환
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('뉴스 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 종목 dart 조회
  getStockDart: async (code) => {
    try {
      const response = await stockAxios.get('/dart/', {
        params: { ticker: code },
      });
      // response.data가 배열인지 확인하고 반환
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('dart 데이터 요청 실패:', error);
      throw error;
    }
  },

  // 종목 이슈 조회
  getStockIssue: async (code) => {
    try {
      const response = await stockAxios.get('/iss/', {
        params: { ticker: code },
      });
      // response 자체가 데이터인 경우를 위해 직접 반환
      return response.data || response;
    } catch (error) {
      console.error('이슈 데이터 요청 실패:', error);
      throw error;
    }
  },

  // 종목 투자자 조회
  getStockInvestor: async (code) => {
    try {
      const response = await stockAxios.get('/investor/', {
        params: { ticker: code },
      });

      // 응답 데이터 구조 확인 및 처리
      if (response.data) {
        const { data, columns, index } = response.data;
        return {
          data: data || [],
          columns: columns || [],
          index: index || [],
        };
      }

      return {
        data: [],
        columns: [],
        index: [],
      };
    } catch (error) {
      console.error('투자자 데이터 요청 실패:', error);
      throw error;
    }
  },

  // 종목 컨센 조회
  getStockConsensus: async (code) => {
    // console.log('컨센 데이터 요청 시작:', code);
    try {
      const response = await stockAxios.get('/finstats/', {
        params: { ticker: code },
      });
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('컨센 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 종목 거래원 조회
  getStockBroker: async (code) => {
    try {
      const response = await stockAxios.get('/broker/', {
        params: { ticker: code },
      });
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('거래원 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 종목 대차정보 조회
  getStockShortInterest: async (code) => {
    try {
      // console.log(`대차정보 API 요청: /shortinterest/?ticker=${code}`);
      const response = await stockAxios.get('/shortinterest/', {
        params: { ticker: code },
      });
      // console.log('대차정보 API 응답 상태:', response.status);
      // console.log('대차정보 API 응답 데이터 타입:', typeof response.data);
      // console.log(
      //   '대차정보 API 응답 데이터 길이:',
      //   Array.isArray(response.data) ? response.data.length : 'N/A'
      // );
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('대차정보 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 종목 공매도 조회
  getStockShort: async (code) => {
    try {
      // console.log(`공매도 API 요청: /short/?ticker=${code}`);
      const response = await stockAxios.get('/short/', {
        params: { ticker: code },
      });
      // console.log('공매도 API 응답 상태:', response.status);
      // console.log('공매도 API 응답 데이터 타입:', typeof response.data);
      // console.log(
      //   '공매도 API 응답 데이터 길이:',
      //   Array.isArray(response.data) ? response.data.length : 'N/A'
      // );
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('공매도 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 즐겨찾기 추가/제거
  toggleFavorite: async (code) => {
    // console.log('즐겨찾기 요청 시작:', code);
    try {
      const response = await stockAxios.post('/favorites/toggle/', {
        ticker_code: code, // param -> ticker_code로 수정
      });
      // console.log('즐겨찾기 응답:', response);
      return response.data;
    } catch (error) {
      console.error('Favorite toggle failed:', error);
      throw error; // 에러를 던져서 컴포넌트에서 처리할 수 있게 함
    }
  },

  // 즐겨찾기 목록 조회
  getFavorites: async () => {
    try {
      const requestUrl = '/favorites/';
      const response = await stockAxios.get(requestUrl);
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('Failed to get favorites:', error);
      console.error('Failed URL:', '/favorites/'); // 에러 시에도 URL 출력
      throw error;
    }
  },

  // 종목 Ohlcv 조회
  getStockOhlcv: async (code, interval = 'day') => {
    try {
      const response = await stockAxios.get('/ohlcv1/', {
        params: {
          ticker: code,
          interval: interval,
        },
      });

      // response가 배열인 경우와 response.data가 배열인 경우 모두 처리
      let ohlcvData = Array.isArray(response) ? response : response.data;

      if (!ohlcvData) {
        console.error('No OHLCV data received');
        throw new Error('차트 데이터를 받지 못했습니다.');
      }

      return {
        data: ohlcvData,
        status: response.status,
      };
    } catch (error) {
      console.error('OHLCV request failed:', {
        code,
        interval,
        error: error.message,
        response: error.response,
      });
      throw error;
    }
  },

  // 매수가격 업데이트 메서드 추가
  updateBuyPrice: async (ticker_code, buy_price) => {
    // console.log('API 요청 정보:', {
    //   url: '/favorites/update_price/',
    //   method: 'POST',
    //   data: { ticker_code, buy_price },
    // });

    try {
      const response = await stockAxios.post('/favorites/update_price/', {
        ticker_code,
        buy_price,
      });
      // console.log('매수가격 업데이트 응답:', response);
      return response.data;
    } catch (error) {
      console.error('매수가격 업데이트 실패:', error);
      console.error('에러 상세:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  },
  // AI 의견 조회 - 수정된 버전과 디버깅 추가
  getOpinion: async () => {
    try {
      // 명확한 디버깅 메시지 추가
      // console.log('AiOpinionViewSet에 API 요청 시작 (/aiopinion/)');
      const response = await stockAxios.get('/aiopinion/');
      // console.log('AiOpinion API 응답:', response);

      // 응답 데이터 처리
      return response.data || response;
    } catch (error) {
      console.error('AI Opinion API 요청 실패:', error);
      throw error;
    }
  },
  // AI 의견 조회
  getOpinionForStock: async (code, options = {}) => {
    try {
      const response = await stockAxios.get('/aiopinionstock/', {
        params: {
          ticker: code,
          anal: options.anal || false,
        },
      });
      return response.data || response;
    } catch (error) {
      console.error('AI Opinion 요청 실패:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },
  // 오늘 AI 의견 조회
  getOpinionForStockToday: async () => {
    try {
      const response = await stockAxios.get('/aiopinionstocktoday/');
      console.log('response', response);
      return response.data || response;
    } catch (error) {
      console.error('AI Opinion today 요청 실패:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },

  // 주요공시 조회
  getStockMainDisclosure: async (code) => {
    try {
      const response = await stockAxios.get('/dartinfo/', {
        params: { ticker: code },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('주요공시 데이터 요청 실패:', error);
      throw error;
    }
  },
};

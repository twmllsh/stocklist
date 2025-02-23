import stockAxios from './config/stockAxios';

export const stockService = {
  getFilteredStocks: async (filters) => {
    try {
      const validParams = {};

      // 필요한 파라미터만 추출
      const booleanFields = [
        'turnarround',
        'newbra',
        'realtime',
        'endprice',
        'sun_gcv',
        'coke_gcv',
        'array',
        'array_exclude',
        'ab',
        'abv',
        'goodwave',
        'ac',
        'new_listing',
        'rsi',
        'exp',
      ];

      // 값이 있는 필터 처리
      const valueFields = {
        consen: 'consen_value',
        sun_ac: 'sun_ac_value',
        coke_up: 'coke_up_value',
      };

      // 불리언 필드 처리
      booleanFields.forEach((field) => {
        if (filters[field]) {
          validParams[field] = '1';
        }
      });

      // 값이 있는 필드 처리
      Object.entries(valueFields).forEach(([key, valueKey]) => {
        if (filters[key] && filters[valueKey]) {
          validParams[key] = filters[valueKey];
        }
      });

      // 등락률 범위 처리 (값이 있을 때만)
      if (filters.change) {
        if (filters.change_min) validParams.change_min = filters.change_min;
        if (filters.change_max) validParams.change_max = filters.change_max;
      }

      console.log('Sending request with params:', validParams);
      const response = await stockAxios.get('/stocklist/', {
        params: validParams,
      });

      console.log('Raw API response:', response);

      // response가 배열인 경우와 response.data가 배열인 경우 모두 처리
      let stockData = Array.isArray(response) ? response : response.data;

      if (!stockData) {
        console.error('No data received');
        throw new Error('No data received');
      }

      // console.log('Processed stock data:', stockData);
      return stockData;
    } catch (error) {
      console.error('Filter request failed:', {
        error,
        response: error.response,
        data: error.response?.data,
      });
      throw error;
    }
  },

  // 종목 뉴스 조회
  getStockNews: async (code) => {
    const response = await stockAxios.get('/news/', {
      params: { ticker: code },
    }); // '/trade' 제거
    console.log('뉴스 데이터 요청 성공:', response);
    return response;
  },

  // 종목 이슈 조회
  getStockIssue: async (code) => {
    try {
      const response = await stockAxios.get('/iss/', {
        params: { ticker: code },
      });
      console.log('이슈 API 응답 구조:', {
        responseType: typeof response,
        hasData: 'data' in response,
        dataType: response.data ? typeof response.data : 'no data',
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
    console.log('투자자 데이터 요청 시작:', code);
    try {
      const response = await stockAxios.get('/investor/', {
        params: { ticker: code },
      });
      console.log('투자자 데이터 요청 성공:', response);
      return response;
    } catch (error) {
      console.error('투자자 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 컨센 조회
  getStockConsensus: async (code) => {
    console.log('컨센 데이터 요청 시작:', code);
    try {
      const response = await stockAxios.get('/finstats/', {
        params: { ticker: code },
      });
      console.log('컨센 데이터 요청 성공:', response);
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('컨센 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 컨센 조회
  getStockBroker: async (code) => {
    console.log('거래원 데이터 요청 시작:', code);
    try {
      const response = await stockAxios.get('/broker/', {
        params: { ticker: code },
      });
      console.log('거래원 데이터 요청 성공:', response);
      // response.data가 있으면 사용하고, 없으면 response 자체를 반환
      return Array.isArray(response.data) ? response.data : response;
    } catch (error) {
      console.error('거래원 데이터 요청 실패:', error);
      throw error;
    }
  },
  // 즐겨찾기 조회 추가 삭제.
  // 즐겨찾기 추가/제거
  // toggleFavorite: async (code) => {
  //   console.log('즐겨찾기 요청 시작:', code);
  //   try {
  //     const response = await stockAxios.post('/favorites/toggle/', {
  //       param: { ticker: code },
  //     });
  //     return Array.isArray(response.data) ? response.data : response;
  //   } catch (error) {
  //     console.error('Favorite toggle failed:', error);
  //   }
  // },

  // // 즐겨찾기 목록 조회
  // getFavorites: async () => {
  //   try {
  //     const response = await stockAxios.get('/api/favorites/');
  //     return Array.isArray(response.data) ? response.data : response;
  //   } catch (error) {
  //     console.error('Failed to get favorites:', error);
  //   }
  // },

  // 종목 Ohlcv 조회
  getStockOhlcv: async (code, interval = 'day') => {
    try {
      console.log(`Requesting OHLCV for ${code} with interval ${interval}`);

      const response = await stockAxios.get('/ohlcv1/', {
        params: {
          ticker: code,
          interval: interval,
        },
      });

      // console.log('Full OHLCV Response:', response);

      // response가 배열인 경우와 response.data가 배열인 경우 모두 처리
      let ohlcvData = Array.isArray(response) ? response : response.data;

      if (!ohlcvData) {
        console.error('No OHLCV data received');
        throw new Error('차트 데이터를 받지 못했습니다.');
      }

      // console.log('Processed OHLCV data:', ohlcvData);

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
};

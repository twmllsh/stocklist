import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { stockService } from '../../services/stockService';

// 비동기 액션 생성
export const fetchFilteredStocks = createAsyncThunk(
  'stock/fetchFiltered',
  async (filters, { rejectWithValue }) => {
    try {
      // URL 파라미터 생성 및 로깅 부분 제거
      // console.log('Fetching stocks with filters:', filters);
      const data = await stockService.getFilteredStocks(filters);
      if (!data) throw new Error('No data received');
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const stockSlice = createSlice({
  name: 'stock',
  initialState: {
    stocks: [], // 초기값을 빈 배열로 설정
    loading: false,
    error: null,
  },
  reducers: {
    setStocks: (state, action) => {
      state.stocks = action.payload;
      state.searchCount = action.payload.length; // 검색 결과 수 추가
    },
    // ...other reducers...
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFilteredStocks.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.stocks = []; // 로딩 시작할 때 stocks 초기화
      })
      .addCase(fetchFilteredStocks.fulfilled, (state, action) => {
        // console.log('Setting stocks:', action.payload);
        state.loading = false;
        state.stocks = action.payload;
        state.error = null;
      })
      .addCase(fetchFilteredStocks.rejected, (state, action) => {
        console.error('Fetch failed:', action.payload);
        state.loading = false;
        state.stocks = [];
        state.error = action.payload;
      });
  },
});

export const selectStocks = (state) => {
  // console.log('Current state:', state);
  return state.stock.stocks || []; // undefined 방지
};
export const selectStockLoading = (state) => state.stock.loading;
export const selectStockError = (state) => state.stock.error;
export const selectSearchCount = (state) => state.stock.searchCount;

export default stockSlice.reducer;

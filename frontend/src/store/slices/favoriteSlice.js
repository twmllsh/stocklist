import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { stockService } from '../../services/stockService';

export const fetchFavorites = createAsyncThunk(
  'favorites/fetchFavorites',
  async (_, { rejectWithValue }) => {
    try {
      const response = await stockService.getFavorites();
      return response.map((item) => item.ticker.code);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const toggleFavoriteStock = createAsyncThunk(
  'favorites/toggleFavorite',
  async (code, { dispatch }) => {
    const response = await stockService.toggleFavorite(code);
    // 토글 후 즐겨찾기 목록 갱신
    await dispatch(fetchFavorites());
    return response;
  }
);

const favoriteSlice = createSlice({
  name: 'favorites',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFavorites.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const selectFavorites = (state) => state.favorites.items;
export default favoriteSlice.reducer;

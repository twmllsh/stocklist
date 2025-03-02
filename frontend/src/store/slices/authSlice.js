import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, { payload }) => {
      state.isAuthenticated = true;
      state.token = payload.access;
      state.user = payload.user;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },
    registerSuccess: (state, { payload }) => {
      state.isAuthenticated = true;
      state.token = payload.access;
      state.user = payload.user;
    },
  },
});

export const { setCredentials, logout, registerSuccess } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;

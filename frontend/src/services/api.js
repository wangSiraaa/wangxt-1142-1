import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success) {
      return response.data.data;
    }
    return Promise.reject(new Error(response.data?.message || '请求失败'));
  },
  (error) => {
    return Promise.reject(error.response?.data?.message || error.message);
  }
);

export const flightApi = {
  getList: (params) => api.get('/flights', { params }),
  getDetail: (id) => api.get(`/flights/${id}`),
  create: (data) => api.post('/flights', data),
  update: (id, data) => api.put(`/flights/${id}`, data),
  remove: (id) => api.delete(`/flights/${id}`),
};

export const mealTypeApi = {
  getList: (params) => api.get('/meal-types', { params }),
  getDetail: (id) => api.get(`/meal-types/${id}`),
};

export const mealRequirementApi = {
  getList: (params) => api.get('/meal-requirements', { params }),
  getDetail: (id) => api.get(`/meal-requirements/${id}`),
  create: (data) => api.post('/meal-requirements', data),
  update: (id, data) => api.put(`/meal-requirements/${id}`, data),
  remove: (id) => api.delete(`/meal-requirements/${id}`),
  getWaitlist: (flightId) => api.get(`/meal-requirements/waitlist/${flightId}`),
  addWaitlist: (data) => api.post('/meal-requirements/waitlist', data),
  transferWaitlist: (id, data) => api.post(`/meal-requirements/waitlist/${id}/transfer`, data),
  recalculate: (flightId, data) => api.post(`/meal-requirements/recalculate/${flightId}`, data),
};

export const mealBoxApi = {
  getList: (params) => api.get('/meal-boxes', { params }),
  getDetail: (id) => api.get(`/meal-boxes/${id}`),
  create: (data) => api.post('/meal-boxes', data),
  update: (id, data) => api.put(`/meal-boxes/${id}`, data),
  load: (id, data) => api.post(`/meal-boxes/${id}/load`, data),
  remove: (id) => api.delete(`/meal-boxes/${id}`),
  reportAnomaly: (id, data) => api.post(`/meal-boxes/${id}/report-anomaly`, data),
  getReplacements: (flightId) => api.get(`/meal-boxes/replacements/${flightId}`),
  reviewReplacement: (id, data) => api.post(`/meal-boxes/replacements/${id}/review`, data),
  addAllergyIsolation: (data) => api.post('/meal-boxes/allergy-isolation', data),
  getAllergyIsolations: (flightId) => api.get(`/meal-boxes/allergy-isolations/${flightId}`),
};

export const loadingCheckApi = {
  getList: (params) => api.get('/loading-checks', { params }),
  getLatest: (flightId) => api.get(`/loading-checks/latest/${flightId}`),
  check: (data) => api.post('/loading-checks/check', data),
};

export const cabinReceiptApi = {
  getList: (params) => api.get('/cabin-receipts', { params }),
  getLatest: (flightId) => api.get(`/cabin-receipts/latest/${flightId}`),
  getBoxes: (flightId) => api.get(`/cabin-receipts/boxes/${flightId}`),
  confirm: (data) => api.post('/cabin-receipts/confirm', data),
  lock: (id) => api.post(`/cabin-receipts/lock/${id}`),
  addDiffDescription: (id, data) => api.post(`/cabin-receipts/diff-description/${id}`, data),
};

export const userApi = {
  getList: (params) => api.get('/users', { params }),
  getDetail: (id) => api.get(`/users/${id}`),
  login: (username) => api.post('/users/login', { username }),
};

export default api;

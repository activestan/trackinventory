import axiosClient from './axiosClient';

// ---- Auth ----
export const login = (email, password) =>
  axiosClient.post('/auth/login', { email, password }).then((res) => res.data);

export const getProfile = () => axiosClient.get('/auth/me').then((res) => res.data);

export const changePassword = (current_password, new_password) =>
  axiosClient
    .put('/auth/change-password', { current_password, new_password })
    .then((res) => res.data);

// ---- Users ----
export const getUsers = () => axiosClient.get('/users').then((res) => res.data);
export const createUser = (data) => axiosClient.post('/users', data).then((res) => res.data);
export const updateUser = (id, data) => axiosClient.put(`/users/${id}`, data).then((res) => res.data);
export const deactivateUser = (id) => axiosClient.put(`/users/${id}/deactivate`).then((res) => res.data);
export const deleteUser = (id) => axiosClient.delete(`/users/${id}`).then((res) => res.data);

// ---- Categories ----
export const getCategories = () => axiosClient.get('/categories').then((res) => res.data);
export const createCategory = (data) => axiosClient.post('/categories', data).then((res) => res.data);

// ---- Suppliers ----
export const getSuppliers = () => axiosClient.get('/suppliers').then((res) => res.data);
export const createSupplier = (data) => axiosClient.post('/suppliers', data).then((res) => res.data);

// ---- Inventory ----
export const getInventoryItems = () => axiosClient.get('/inventory').then((res) => res.data);
export const getInventoryItem = (id) => axiosClient.get(`/inventory/${id}`).then((res) => res.data);
export const createInventoryItem = (data) => axiosClient.post('/inventory', data).then((res) => res.data);
export const updateInventoryItem = (id, data) => axiosClient.put(`/inventory/${id}`, data).then((res) => res.data);
export const deleteInventoryItem = (id) => axiosClient.delete(`/inventory/${id}`).then((res) => res.data);
export const recordStockTransaction = (id, data) =>
  axiosClient.post(`/inventory/${id}/transactions`, data).then((res) => res.data);
export const getItemTransactions = (id) =>
  axiosClient.get(`/inventory/${id}/transactions`).then((res) => res.data);
export const getRecentTransactions = (limit = 10) =>
  axiosClient.get(`/inventory/transactions/recent?limit=${limit}`).then((res) => res.data);

// ---- Assets ----
export const getAssets = () => axiosClient.get('/assets').then((res) => res.data);
export const getAsset = (id) => axiosClient.get(`/assets/${id}`).then((res) => res.data);
export const createAsset = (data) => axiosClient.post('/assets', data).then((res) => res.data);
export const updateAsset = (id, data) => axiosClient.put(`/assets/${id}`, data).then((res) => res.data);
export const deleteAsset = (id) => axiosClient.delete(`/assets/${id}`).then((res) => res.data);
export const transferAsset = (id, data) => axiosClient.post(`/assets/${id}/transfer`, data).then((res) => res.data);
export const updateAssetStatus = (id, data) => axiosClient.put(`/assets/${id}/status`, data).then((res) => res.data);
export const getAssetHistory = (id) => axiosClient.get(`/assets/${id}/history`).then((res) => res.data);

// ---- Alerts ----
export const getAlerts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return axiosClient.get(`/alerts${query ? `?${query}` : ''}`).then((res) => res.data);
};
export const getAlertSummary = () => axiosClient.get('/alerts/summary').then((res) => res.data);

// ---- Reports / Dashboard ----
export const getDashboardSummary = () => axiosClient.get('/reports/dashboard').then((res) => res.data);
export const getStockByCategory = () => axiosClient.get('/reports/stock-by-category').then((res) => res.data);

// ---- Sales Uploads ----
export const uploadSalesFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient
    .post('/sales-uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data);
};
export const getSalesUploads = () => axiosClient.get('/sales-uploads').then((res) => res.data);
export const getSalesUpload = (id) => axiosClient.get(`/sales-uploads/${id}`).then((res) => res.data);

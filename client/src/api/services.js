import axiosClient from './axiosClient';

// ---- Auth ----
export const login = (email, password) =>
  axiosClient.post('/auth/login', { email, password }).then((res) => res.data);

export const getProfile = () => axiosClient.get('/auth/me').then((res) => res.data);

export const changePassword = (current_password, new_password) =>
  axiosClient
    .put('/auth/change-password', { current_password, new_password })
    .then((res) => res.data);

export const forgotPassword = (email) =>
  axiosClient.post('/auth/forgot-password', { email }).then((res) => res.data);

export const resetPassword = (email, token, new_password) =>
  axiosClient
    .post('/auth/reset-password', { email, token, new_password })
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
// Accepts an optional params object (search, category_id, low_stock,
// page, limit). When page/limit are omitted, the backend returns a bare
// array (unchanged legacy shape); when supplied, it returns
// { items, page, limit, total, totalPages } for pagination controls.
export const getInventoryItems = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  ).toString();
  return axiosClient.get(`/inventory${query ? `?${query}` : ''}`).then((res) => res.data);
};
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
// Accepts an optional params object (search, category_id, current_status,
// page, limit) — same bare-array-vs-paginated-object behaviour as
// getInventoryItems above.
export const getAssets = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  ).toString();
  return axiosClient.get(`/assets${query ? `?${query}` : ''}`).then((res) => res.data);
};
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

// Downloads the alert history as a CSV file, triggering a browser save
// dialog by creating a temporary object URL from the response blob.
export const exportAlertHistoryCsv = () =>
  axiosClient.get('/alerts/history/export', { responseType: 'blob' }).then((res) => downloadBlob(res.data, 'alert_history.csv'));

// ---- Alert Settings (admin-configurable cooldown timing) ----
export const getAlertSettings = () => axiosClient.get('/alerts/settings').then((res) => res.data);
export const updateAlertSettings = (data) => axiosClient.put('/alerts/settings', data).then((res) => res.data);

// ---- Reports / Dashboard ----
export const getDashboardSummary = () => axiosClient.get('/reports/dashboard').then((res) => res.data);
export const getStockByCategory = () => axiosClient.get('/reports/stock-by-category').then((res) => res.data);
export const exportStockByCategoryCsv = () =>
  axiosClient.get('/reports/stock-by-category/export', { responseType: 'blob' }).then((res) => downloadBlob(res.data, 'stock_by_category.csv'));
export const exportDashboardPdf = () =>
  axiosClient.get('/reports/dashboard/export', { responseType: 'blob' }).then((res) => downloadBlob(res.data, 'dashboard_summary.pdf'));

// ---- Activity Log (merged stock transactions + asset movements) ----
export const getActivityLog = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  ).toString();
  return axiosClient.get(`/activity-log${query ? `?${query}` : ''}`).then((res) => res.data);
};

/**
 * Shared helper for every "download as file" API call above: takes a
 * Blob response body and a suggested filename, and triggers the
 * browser's native download behaviour via a temporary anchor element.
 */
function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

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
export const downloadSalesUploadTemplate = () =>
  axiosClient.get('/sales-uploads/template', { responseType: 'blob' }).then((res) => downloadBlob(res.data, 'sales_upload_template.csv'));

import { useEffect, useState, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import * as api from '../api/services';

export default function SalesUploadPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [viewingUpload, setViewingUpload] = useState(null);
  const fileInputRef = useRef(null);

  async function loadUploads() {
    setLoading(true);
    try {
      const data = await api.getSalesUploads();
      setUploads(data);
    } catch (err) {
      setError('Unable to load sales upload history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUploads();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setLastResult(null);
    try {
      const result = await api.uploadSalesFile(file);
      setLastResult(result);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadUploads();
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading sales file.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppLayout title="Daily Sales Upload">
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Upload a Day's Sales</h3>
        <p className="muted">
          Upload a CSV or Excel (.xlsx / .xls) file listing each item sold and the quantity sold.
          The file must include a column identifying the item by <strong>SKU code</strong>
          (accepted headers: SKU, SKU Code, Item SKU, Code) and a column for the{' '}
          <strong>quantity sold</strong> (accepted headers: Quantity, Qty, Quantity Sold, Units
          Sold). Each valid row is automatically recorded as a Stock-Out transaction, reducing the
          item's stock level exactly as a manual sale would, and feeding directly into the
          low-stock alert system.
        </p>
        <div className="panel" style={{ background: '#f9fafb', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <strong>Example format (CSV or the first sheet of an Excel workbook):</strong>
          </p>
          <pre style={{ margin: '8px 0 0', fontSize: '0.82rem', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e4e7ec' }}>
sku,quantity{'\n'}NET-CAT6-001,2{'\n'}COM-MSE-004,3{'\n'}CON-TNR-003,1
          </pre>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => api.downloadSalesUploadTemplate()}
          >
            ⬇ Download a Ready-to-Fill CSV Template
          </button>
        </div>

        {error && <div className="alert-banner alert-banner--error">{error}</div>}

        <form onSubmit={handleUpload} className="form-grid">
          <label>
            Sales File (.csv, .xlsx, or .xls)
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              required
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </label>
          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" className="btn-primary" disabled={uploading || !file}>
              {uploading ? 'Processing...' : 'Upload & Process Sales'}
            </button>
          </div>
        </form>

        {lastResult && (
          <div style={{ marginTop: 18 }}>
            <div className="alert-banner alert-banner--success">
              Processed {lastResult.total_rows} row(s): {lastResult.success_count} recorded
              successfully, {lastResult.failure_count} failed.
            </div>
            <UploadResultTable upload={lastResult} />
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Upload History</h3>
        {loading ? (
          <p>Loading upload history...</p>
        ) : uploads.length === 0 ? (
          <p className="muted">No sales files have been uploaded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Total Rows</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u._id}>
                  <td>{u.original_filename}</td>
                  <td>{u.uploaded_by?.full_name || '—'}</td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>{u.total_rows}</td>
                  <td><span className="badge badge-green">{u.success_count}</span></td>
                  <td>
                    {u.failure_count > 0 ? (
                      <span className="badge badge-red">{u.failure_count}</span>
                    ) : (
                      <span className="badge badge-green">0</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => setViewingUpload(u._id)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingUpload && (
        <UploadDetailModal uploadId={viewingUpload} onClose={() => setViewingUpload(null)} />
      )}
    </AppLayout>
  );
}

function UploadResultTable({ upload }) {
  return (
    <table className="data-table" style={{ marginTop: 12 }}>
      <thead>
        <tr>
          <th>Row</th>
          <th>SKU</th>
          <th>Qty</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        {upload.row_results.map((r) => (
          <tr key={r.row_number}>
            <td>{r.row_number}</td>
            <td>{r.sku_code}</td>
            <td>{r.quantity ?? '—'}</td>
            <td>
              <span className={`badge ${r.status === 'Success' ? 'badge-green' : 'badge-red'}`}>
                {r.status}
              </span>
            </td>
            <td>{r.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UploadDetailModal({ uploadId, onClose }) {
  const [upload, setUpload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSalesUpload(uploadId).then(setUpload).finally(() => setLoading(false));
  }, [uploadId]);

  return (
    <Modal title="Sales Upload Details" onClose={onClose}>
      {loading ? (
        <p>Loading...</p>
      ) : upload ? (
        <UploadResultTable upload={upload} />
      ) : (
        <p>Could not load upload details.</p>
      )}
    </Modal>
  );
}

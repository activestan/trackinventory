import { useEffect, useState } from 'react';
import AppLayout from '../components/AppLayout';
import * as api from '../api/services';

const PAGE_SIZE = 15;

const CATEGORY_BADGE = {
  'Stock Transaction': 'badge-blue',
  'Asset Movement': 'badge-green',
};

export default function ActivityLogPage() {
  const [logPage, setLogPage] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  async function loadLog() {
    setLoading(true);
    try {
      const data = await api.getActivityLog({ page, limit: PAGE_SIZE });
      setLogPage(data);
    } catch (err) {
      setError('Unable to load the activity log.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <AppLayout title="Activity Log">
      <div className="panel" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          A single chronological timeline of everything that has happened across both inventory
          (stock in/out) and asset management (assignments, transfers, status changes), most
          recent first.
        </p>
      </div>

      {error && <div className="alert-banner alert-banner--error">{error}</div>}
      {loading ? (
        <p>Loading activity log...</p>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Performed By</th>
                <th>Remarks</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logPage.items.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className={`badge ${CATEGORY_BADGE[event.category] || 'badge-blue'}`}>
                      {event.category}
                    </span>
                  </td>
                  <td>{event.description}</td>
                  <td>{event.performed_by}</td>
                  <td>{event.remarks || '—'}</td>
                  <td>{new Date(event.date).toLocaleString()}</td>
                </tr>
              ))}
              {logPage.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No activity has been recorded yet. Stock transactions and asset movements will
                    appear here automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {logPage.totalPages > 1 && (
            <div className="pagination-bar">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <span className="pagination-info">
                Page {logPage.page} of {logPage.totalPages} ({logPage.total} events)
              </span>
              <button
                className="btn-secondary"
                disabled={page >= logPage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

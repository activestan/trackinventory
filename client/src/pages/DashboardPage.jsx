import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AppLayout from '../components/AppLayout';
import StatCard from '../components/StatCard';
import * as api from '../api/services';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [summaryData, catData] = await Promise.all([
          api.getDashboardSummary(),
          api.getStockByCategory(),
        ]);
        setSummary(summaryData);
        setCategoryData(catData.map((c) => ({ name: c._id, quantity: c.totalQuantity })));
      } catch (err) {
        setError('Unable to load dashboard data. Please ensure the backend server is running.');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <AppLayout title="Inventory Overview">
      {loading && <p>Loading dashboard...</p>}
      {error && <div className="alert-banner alert-banner--error">{error}</div>}

      {summary && (
        <>
          <div className="stat-grid">
            <StatCard icon="📦" label="Total Stock Items" value={summary.totalItems} sub="All tracked items" color="blue" />
            <StatCard icon="⚠️" label="Low Stock Items" value={summary.lowStockItems} sub="Items below threshold" color="orange" />
            <StatCard icon="🖥️" label="Total Assets" value={summary.totalAssets} sub="Managed business assets" color="green" />
            <StatCard icon="🔔" label="Pending Alerts" value={summary.pendingAlerts} sub="Action required" color="red" />
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <h3>Stock Levels by Category</h3>
              {categoryData.length === 0 ? (
                <p className="muted">No inventory data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#2f6fed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="panel">
              <h3>Recent Stock Transactions</h3>
              {summary.recentTransactions.length === 0 ? (
                <p className="muted">No transactions recorded yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentTransactions.map((t) => (
                      <tr key={t._id}>
                        <td>{t.item_id?.item_name || '—'}</td>
                        <td>
                          <span className={`badge ${t.transaction_type === 'Stock-In' ? 'badge-green' : 'badge-orange'}`}>
                            {t.transaction_type}
                          </span>
                        </td>
                        <td>{t.quantity}</td>
                        <td>{new Date(t.transaction_date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

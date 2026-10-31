import { useEffect, useState } from 'react';

export default function AdminPayments() {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/payments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.transactions) setTransactions(data.transactions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  // Helper to color-code amounts and badges
  const getTypeStyles = (type) => {
    switch (type) {
      case 'DEPOSIT': return { badge: 'bg-green-900 text-green-300', text: 'text-green-400', sign: '+' };
      case 'WINNING_PAYOUT': return { badge: 'bg-yellow-900 text-yellow-300', text: 'text-yellow-400', sign: '+' };
      case 'ENTRY_FEE': return { badge: 'bg-red-900 text-red-300', text: 'text-red-400', sign: '-' };
      case 'WITHDRAWAL': return { badge: 'bg-red-900 text-red-300', text: 'text-red-400', sign: '-' };
      case 'ADMIN_ADJUSTMENT': return { badge: 'bg-blue-900 text-blue-300', text: 'text-blue-400', sign: '' };
      default: return { badge: 'bg-gray-700 text-gray-300', text: 'text-gray-300', sign: '' };
    }
  };

  // Filter transactions by User, Type, or Reference
  const filteredTransactions = transactions.filter(tx => {
    const search = searchTerm.toLowerCase();
    const userName = (tx.first_name || tx.username || 'Unknown').toLowerCase();
    return (
      userName.includes(search) ||
      tx.type.toLowerCase().includes(search) ||
      (tx.reference_id && tx.reference_id.toLowerCase().includes(search))
    );
  });

  if (loading) return <div className="text-white p-6">Loading payments...</div>;

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Financial Ledger</h1>
        
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search by user, type, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 w-96"
        />
      </div>
      
      <div className="overflow-x-auto w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
        <table className="w-full text-left text-sm text-slate-300 min-w-[800px]">
          <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-400">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Transaction Type</th>
              <th className="px-6 py-4">Amount (ETB)</th>
              <th className="px-6 py-4">Reference / Room ID</th>
              <th className="px-6 py-4">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredTransactions.map((tx) => {
              const styles = getTypeStyles(tx.type);
              return (
                <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{tx.first_name || 'No Name'}</div>
                    <div className="text-xs text-slate-500">@{tx.username || tx.telegram_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles.badge}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-mono font-bold text-lg ${styles.text}`}>
                    {styles.sign}{Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-400">
                    {tx.reference_id ? (tx.reference_id.length > 15 ? `...${tx.reference_id.slice(-8)}` : tx.reference_id) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
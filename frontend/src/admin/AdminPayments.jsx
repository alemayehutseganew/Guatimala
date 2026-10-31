import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminPayments() {
  const [transactions, setTransactions] = useState([])
  const token = localStorage.getItem('adminToken')

  const load = () => {
    fetch(`${API_BASE}/api/admin/payments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions || []))
      .catch(() => {})
  }

  useEffect(load, [token])

  const typeColor = (t) => {
    const type = (t || '').toUpperCase()
    if (type.includes('DEPOSIT')) return 'text-green-400'
    if (type.includes('WITHDRAW')) return 'text-red-400'
    if (type.includes('ENTRY') || type.includes('FEE')) return 'text-gray-400'
    if (type.includes('WIN') || type.includes('PAYOUT')) return 'text-yellow-400'
    return 'text-white'
  }

  const amountDisplay = (t, amt) => {
    const type = (t || '').toUpperCase()
    if (type.includes('DEPOSIT') || type.includes('WIN') || type.includes('PAYOUT')) return `+${amt}`
    if (type.includes('WITHDRAW') || type.includes('ENTRY') || type.includes('FEE')) return `-${amt}`
    return amt
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Financial Movements</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">User</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Reference</th>
            <th className="p-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-gray-700 hover:bg-gray-800">
              <td className="p-2">{t.id}</td>
              <td className="p-2">{t.first_name || t.username || 'Unknown'}</td>
              <td className={`p-2 ${typeColor(t.type)}`}>{t.type}</td>
              <td className="p-2">{amountDisplay(t.type, t.amount)}</td>
              <td className="p-2">{t.reference || '-'}</td>
              <td className="p-2">{t.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

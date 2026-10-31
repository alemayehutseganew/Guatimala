import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const token = localStorage.getItem('adminToken')

  const load = () => {
    fetch(`${API_BASE}/api/admin/payments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPayments)
      .catch(() => {})
  }

  useEffect(load, [token])

  const approve = async (id) => {
    await fetch(`${API_BASE}/api/admin/payments/${id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Payments</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">User</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-left">Provider</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Reference</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-gray-700 hover:bg-gray-800">
              <td className="p-2">{p.id}</td>
              <td className="p-2">{p.user_id}</td>
              <td className="p-2">{p.type}</td>
              <td className="p-2">{p.provider}</td>
              <td className="p-2">{p.amount}</td>
              <td className="p-2">{p.status}</td>
              <td className="p-2">{p.transaction_reference}</td>
              <td className="p-2">
                {p.status === 'pending' && p.type === 'withdrawal' && (
                  <button
                    onClick={() => approve(p.id)}
                    className="bg-green-600 px-2 py-1 rounded text-xs"
                  >
                    Approve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

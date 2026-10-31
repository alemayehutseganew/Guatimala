import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const token = localStorage.getItem('adminToken')

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [token])

  if (!stats) return <div className="text-white">Loading...</div>

  const cards = [
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'Active Games', value: stats.activeGames },
    { label: 'Total Wagered', value: stats.totalWagered },
    { label: 'Platform Profit', value: stats.totalPlatformProfit },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-800 p-4 rounded">
            <p className="text-gray-400 text-sm">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-gray-800 p-4 rounded">
        <p className="mb-2 font-bold">Daily Wagered (mock)</p>
        <div className="flex items-end gap-2 h-32">
          {[30, 50, 20, 70, 40, 60, 80].map((v, i) => (
            <div key={i} className="flex-1 bg-blue-500" style={{ height: `${v}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

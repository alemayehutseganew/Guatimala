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
    { label: 'Platform Profit', value: stats.platformProfit },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-l-4 border-blue-500">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Users</h3>
          <p className="text-4xl font-bold text-white">{stats.totalUsers}</p>
        </div>

        {/* Active Games */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-l-4 border-green-500">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Active Games</h3>
          <p className="text-4xl font-bold text-white">{stats.activeGames}</p>
        </div>

        {/* Total Wagered */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-l-4 border-yellow-500">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Wagered</h3>
          <p className="text-4xl font-bold text-white">ETB {stats.totalWagered}</p>
        </div>

        {/* Platform Profit */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-l-4 border-purple-500">
          <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Platform Profit</h3>
          <p className="text-4xl font-bold text-white">ETB {stats.platformProfit}</p>
        </div>
      </div>
    </div>
  )
}

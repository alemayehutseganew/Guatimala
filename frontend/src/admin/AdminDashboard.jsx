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
      <h1 className="text-2xl font-bold mb-4 text-white">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">👥</div>
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Users</h3>
          <p className="text-4xl font-black text-white">{stats.totalUsers}</p>
          <div className="mt-4 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-3/4"></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🎮</div>
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Active Games</h3>
          <p className="text-4xl font-black text-white">{stats.activeGames}</p>
          <div className="mt-4 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-2/4"></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">💰</div>
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Wagered</h3>
          <p className="text-4xl font-black text-white">ETB {stats.totalWagered}</p>
          <div className="mt-4 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 w-4/5"></div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">📈</div>
          <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Platform Profit</h3>
          <p className="text-4xl font-black text-white">ETB {stats.platformProfit}</p>
          <div className="mt-4 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

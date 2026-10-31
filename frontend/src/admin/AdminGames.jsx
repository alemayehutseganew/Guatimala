import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminGames() {
  const [games, setGames] = useState([])
  const token = localStorage.getItem('adminToken')

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setGames(d.games || []))
      .catch(() => {})
  }, [token])

  const statusColor = (s) => (s === 'ENDED' || s === 'FINISHED' ? 'text-green-400' : 'text-yellow-400')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Game History</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="p-2 text-left">Room ID</th>
            <th className="p-2 text-left">Stake</th>
            <th className="p-2 text-left">Players</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Winner</th>
            <th className="p-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="border-b border-gray-700 hover:bg-gray-800">
              <td className="p-2">{String(g.id).slice(-6)}</td>
              <td className="p-2">{g.stake_amount} ETB</td>
              <td className="p-2">{g.total_players}</td>
              <td className={`p-2 ${statusColor(g.status)}`}>{g.status}</td>
              <td className="p-2">{g.winner_name}</td>
              <td className="p-2">{g.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


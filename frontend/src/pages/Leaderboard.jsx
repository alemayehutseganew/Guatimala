import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/users/leaderboard`)
      .then((r) => (r.ok ? r.json() : { leaders: [] }))
      .then((data) => setLeaders(data.leaders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#112A46] text-white p-4">
      <button onClick={() => navigate('/')} className="mb-4 text-yellow-400">← Back</button>
      <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
      {loading ? (
        <p>Loading...</p>
      ) : leaders.length === 0 ? (
        <p>No leaders yet.</p>
      ) : (
        <ol className="space-y-2">
          {leaders.map((l, i) => (
            <li key={i} className="bg-white/10 rounded p-3">
              {i + 1}. {l.first_name || 'Player'} - {l.demo_wallet_balance} ETB
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

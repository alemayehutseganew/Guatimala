import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function GameHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = localStorage.getItem('dbUserId') || localStorage.getItem('telegram_id') || 1
    fetch(`${API_BASE}/api/users/history?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => setHistory(data.history || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#112A46] text-white p-4">
      <button onClick={() => navigate('/')} className="mb-4 text-yellow-400">← Back</button>
      <h1 className="text-2xl font-bold mb-4">Game History</h1>
      {loading ? (
        <p>Loading...</p>
      ) : history.length === 0 ? (
        <p>No history yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h, i) => (
            <li key={i} className="bg-white/10 rounded p-3">
              Stake: {h.stake_amount} | Status: {h.is_winner ? 'Won' : 'Lost'} | Date: {new Date(h.joined_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

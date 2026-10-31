import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Wallet() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const token = localStorage.getItem('token')
  const userId = user?.id || 1

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data)
        }
      } catch (e) {}
    }
    load()
  }, [token])

  const deposit = async (provider) => {
    setLoading(true)
    setMessage('')
    try {
      const endpoint = `${API_BASE}/api/payments/initiate`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), userId, provider }),
      })
      const data = await res.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else if (data.success) {
        setMessage(data.message || 'Deposit successful')
        const r = await fetch(`${API_BASE}/api/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (r.ok) setUser(await r.json())
      } else {
        setMessage(data.error || 'Deposit failed')
      }
    } catch (e) {
      setMessage('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#112A46] text-white p-4">
      <button onClick={() => navigate('/')} className="mb-4 text-yellow-400">← Back</button>
      <h1 className="text-2xl font-bold mb-4">Wallet</h1>

      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-300">Balance</p>
        <p className="text-2xl font-bold">ETB {user?.wallet_balance ?? '0.00'}</p>
        <p className="text-sm text-gray-300 mt-2">Demo Balance: {user?.demo_wallet_balance ?? '100.00'}</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm mb-1">Amount</label>
        <input
          type="number"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-[#1e3a5f] text-white placeholder-white border-2 border-gray-600 rounded-lg p-3 text-xl font-bold focus:outline-none focus:border-yellow-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => deposit('telebirr')}
          disabled={loading}
          className="flex-1 bg-yellow-400 text-[#112A46] font-bold py-2 rounded disabled:opacity-50"
        >
          Deposit via Telebirr
        </button>
        <button
          onClick={() => deposit('cbe')}
          disabled={loading}
          className="flex-1 bg-green-500 text-white font-bold py-2 rounded disabled:opacity-50"
        >
          Deposit via CBE Birr
        </button>
      </div>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  )
}

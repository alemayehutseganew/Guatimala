import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function Wallet() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState(100)
  const [phoneNumber, setPhoneNumber] = useState('')

  const token = localStorage.getItem('token')
  const userId = user?.id || localStorage.getItem('dbUserId')

  const loadUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) setUser(await res.json())
    } catch (e) {}
  }

  useEffect(() => {
    loadUser()
  }, [token])

  const withdraw = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: Number(withdrawAmount), provider: 'telebirr', phoneNumber }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || 'Withdrawal submitted')
        loadUser()
      } else {
        setMessage(data.error || 'Withdrawal failed')
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

      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <h2 className="text-lg font-bold mb-2">Withdraw</h2>
        <p className="text-sm text-gray-300 mb-2">Minimum withdrawal: 100 ETB</p>
        <input
          type="number"
          placeholder="Amount"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          className="w-full bg-[#1e3a5f] text-white placeholder-white border-2 border-gray-600 rounded-lg p-3 mb-2"
        />
        <input
          type="text"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full bg-[#1e3a5f] text-white placeholder-white border-2 border-gray-600 rounded-lg p-3 mb-2"
        />
        <button
          onClick={withdraw}
          disabled={loading}
          className="w-full bg-red-500 text-white font-bold py-2 rounded disabled:opacity-50"
        >
          Withdraw
        </button>
      </div>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  )
}

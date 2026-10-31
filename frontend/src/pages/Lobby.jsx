import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../LanguageContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const stakes = [10,50,100]

const AMHARIC_INSTRUCTIONS = `እንኳን ወደ ጎቢንጎ በደህና መጡ!

የጨዋታ መመሪያ፦

ከላይ ካለው ዝርዝር ውስጥ የሚፈልጉትን ውለታ (Stake) ይምረጡ።

ከ1-400 የካርድ መምረጫ ቦርድ ውስጥ እስከ 2 የመጫወቻ ካርድ ይምረጡ።

ጨዋታው ሲጀመር ሲስተሙ ከ1 እስከ 75 ያሉ ቁጥሮችን ያስነብባል።

በካርድዎ ላይ ያሉትን ቁጥሮች በመንካት ያጥቁሩ (Shade)።

ወደጎን፣ ወደታች፣ ወይም ወደ ሁለቱም አግዳሚ መስመር ካሳዩ ወይም 4 ማእዘናትን ካሟሉ አሸናፊ ይሆናሉ።

አሸንፈዋል ብለው ሲያምኑ "BINGO" የሚለውን ቁልፍ ይጫኑ።

መልካም ጨዋታ!`

export default function Lobby() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { changeLanguage } = useLanguage()

  const [walletBalance, setWalletBalance] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('dbUserId')
    if (userId) {
      fetch(`${API_BASE}/api/wallet/balance?userId=${userId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setWalletBalance(Number(data.balance ?? 0))
        })
        .catch(() => {})
    }
  }, [])

  const toggleLanguage = () => {
    changeLanguage(i18n.language === 'en' ? 'am' : 'en')
  }

  const handleJoin = async (stake) => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake }),
      })
      const data = await res.json()
      if (data.roomId) {
        navigate(`/select-cards?roomId=${data.roomId}&stake=${stake}`)
      }
    } catch (e) {
      console.error('Join room failed', e)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close()
    } else {
      window.location.reload()
    }
  }


  return (
    <div className="min-h-screen bg-[#112A46] text-white flex flex-col items-center px-4 py-4">
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 bg-[#0d2238] h-full p-6 shadow-2xl">
            <button onClick={() => setMenuOpen(false)} className="text-white text-2xl mb-6">✕</button>
            <ul className="space-y-4">
              <li><button onClick={() => navigate('/history')} className="text-white w-full text-left">Game History</button></li>
              <li><button onClick={() => navigate('/leaderboard')} className="text-white w-full text-left">Leaderboard</button></li>
              <li><button onClick={() => navigate('/settings')} className="text-white w-full text-left">Settings</button></li>
              <li><button onClick={handleLogout} className="text-red-400 w-full text-left">Logout</button></li>
            </ul>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)}></div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#112A46] text-white rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setHelpOpen(false)} className="absolute top-3 right-3 text-white text-xl">✕</button>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{AMHARIC_INSTRUCTIONS}</pre>
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <button onClick={() => setMenuOpen(true)} className="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" />
          <div className="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-[#112A46] font-bold text-lg"
          >
            ?
          </button>
          <button
            onClick={toggleLanguage}
            className="bg-white text-[#112A46] text-xs font-bold px-3 py-1.5 rounded-full"
          >
            {i18n.language === 'en' ? 'AM' : 'EN'}
          </button>
          <div 
            onClick={() => navigate('/wallet')} 
            className="flex items-center gap-2 bg-white text-[#112A46] rounded-full px-4 py-2 font-semibold cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 5h18" />
            </svg>
            <span>ETB {walletBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <div className="text-xl font-bold text-yellow-400 tracking-wide">
          GOBINGO
        </div>
      </div>

      <h1 className="w-full max-w-md text-2xl font-bold mb-4">{t('chooseStake')}</h1>

      <div className="w-full max-w-md bg-[#0d2238] rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 text-center text-sm font-semibold bg-[#0a1a2e] py-2">
          <div>{t('stake')}</div>
          <div>{t('join')}</div>
        </div>
        {stakes.map((stake) => (
          <div key={stake} className="grid grid-cols-2 text-center items-center py-3 border-b border-[#1e3a5f] last:border-b-0">
            <div className="text-green-400 font-bold text-lg">{stake}</div>
            <div className="flex justify-center">
              <button
                onClick={() => handleJoin(stake)}
                className="bg-white text-[#112A46] text-xs font-bold px-4 py-1.5 rounded shadow"
              >
                {t('join')} &gt;&gt;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

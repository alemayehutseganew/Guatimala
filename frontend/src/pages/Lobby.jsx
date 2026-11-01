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
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      const userId = localStorage.getItem('dbUserId')
      const res = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake, userId }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.log('Backend error response:', data)
        const errorCode = data.error || data.message || ''

        if (errorCode.includes('INSUFFICIENT_BALANCE') || errorCode.includes('Insufficient')) {
          alert('💰 Insufficient Balance\n\nYou need at least ' + stake + ' ETB to join this game.\n\nPlease deposit funds via the Telegram bot first.')
        } else {
          alert('Error: ' + (data.message || data.error || 'Something went wrong. Please try again.'))
        }
        return
      }

      if (data.roomId) {
        sessionStorage.setItem('activeRoomId', data.activeRoomId || '');
        navigate(`/select-cards?roomId=${data.roomId}&stake=${stake}`);
      }
    } catch (e) {
      console.error('Join room failed', e)
      alert('Network error. Please check your connection and try again.')
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
  <div className="min-h-screen bg-gradient-to-b from-[#0f2027] via-[#203a43] to-[#2c5364] text-white font-sans flex flex-col relative overflow-hidden">
    
    {/* Decorative background glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-yellow-500/20 rounded-full blur-[120px] pointer-events-none"></div>

    {/* Top Navigation Bar */}
    <div className="relative z-10 flex items-center justify-between px-4 py-4">
      <button className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/20 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleLanguage}
          className="px-3 py-1.5 bg-white/10 backdrop-blur-md text-white text-xs font-bold rounded-full border border-white/10 hover:bg-white/20 transition-all"
        >
          {i18n.language === 'en' ? 'AM' : 'EN'}
        </button>
        <div 
  onClick={() => navigate('/wallet')}
  className="flex items-center gap-2 bg-white text-[#0f2027] rounded-full px-4 py-1.5 font-extrabold shadow-lg shadow-yellow-500/20 cursor-pointer hover:scale-105 transition-transform"
>
          <span className="text-green-600 text-lg">₿</span>
          <span>ETB {walletBalance.toFixed(2)}</span>
        </div>
      </div>
    </div>

    {/* Header */}
    <div className="relative z-10 text-center mt-6 mb-10 px-4">
      <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-lg">
        GOBINGO
      </h1>
      <p className="text-gray-400 font-medium mt-2 tracking-widest uppercase text-xs">
        Play • Win • Repeat
      </p>
    </div>

    {/* Main Content */}
    <div className="relative z-10 flex-1 px-4 pb-10">
      <h2 className="text-center text-xl font-bold text-white mb-6">
        {t('chooseStake')}
      </h2>

      <div className="flex flex-col gap-4 max-w-md mx-auto">
        {stakes.map((stake, idx) => (
          <div 
            key={stake} 
            className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl hover:bg-white/10 transition-all group overflow-hidden"
          >
            {/* Bonus Ribbon (Only for first two) */}
            {idx < 2 && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-500 text-[#0f2027] text-[10px] font-black px-4 py-1 rounded-bl-xl shadow-lg">
                BONUS
              </div>
            )}

            {/* Left side: Stake Value */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Stake</span>
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                {stake} <span className="text-sm">ETB</span>
              </span>
            </div>

            {/* Right side: Join Button */}
            <button
              onClick={() => handleJoin(stake)}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-[#0f2027] font-black text-lg px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 group-hover:scale-105 active:scale-95 transition-all"
            >
              JOIN
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom Decorative Element */}
    <div className="relative z-10 text-center pb-6">
      <p className="text-xs text-gray-500">Powered by Telebirr • Secure Payments</p>
    </div>
  </div>



);
}

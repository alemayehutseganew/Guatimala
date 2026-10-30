import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const stakes = [10, 20, 30, 50, 80, 100, 150, 200]

export default function Lobby() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')
  }

  return (
    <div className="min-h-screen bg-[#112A46] text-white flex flex-col items-center px-4 py-4">
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        {/* Help icon */}
        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-[#112A46] font-bold text-lg">
          ?
        </div>
        {/* Toggle switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" />
          <div className="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
        </label>
        {/* Wallet pill + language toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="bg-white text-[#112A46] text-xs font-bold px-3 py-1.5 rounded-full"
          >
            {i18n.language === 'en' ? 'AM' : 'EN'}
          </button>
          <div className="flex items-center gap-2 bg-white text-[#112A46] rounded-full px-4 py-2 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 5h18" />
            </svg>
            <span>ETB 20.00</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button className="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="text-xl font-bold text-yellow-400 tracking-wide">
          ETHIO BINGO
        </div>
      </div>

      {/* Title */}
      <h1 className="w-full max-w-md text-2xl font-bold mb-4">{t('chooseStake')}</h1>

      {/* Stake Table */}
      <div className="w-full max-w-md bg-[#0d2238] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-4 text-center text-sm font-semibold bg-[#0a1a2e] py-2">
          <div>{t('stake')}</div>
          <div>{t('active')}</div>
          <div>{t('possibleWin')}</div>
          <div>{t('join')}</div>
        </div>
        {/* Rows */}
        {stakes.map((stake, idx) => (
          <div key={stake} className="relative grid grid-cols-4 items-center text-center py-3 border-t border-[#1a3a5c]">
            {idx < 2 && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 bg-yellow-400 text-[#112A46] text-[10px] font-bold px-2 py-0.5 rounded">
                {t('bonus')}
              </span>
            )}
            <div className="text-green-400 font-bold">{stake}</div>
            <div className="text-gray-300 text-sm">{t('none')}</div>
            <div className="flex items-center justify-center gap-1 text-gray-300 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              -
            </div>
            <div>
              <button
                onClick={() => navigate(`/select-cards?stake=${stake}`)}
                className="bg-white text-[#112A46] text-xs font-bold px-3 py-1 rounded"
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


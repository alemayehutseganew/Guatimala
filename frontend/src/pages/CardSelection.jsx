import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const MAX_SELECTION = 2

export default function CardSelection() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const roomId = searchParams.get('roomId')
  const stake = searchParams.get('stake') || '10'

  if (!roomId) {
    navigate('/')
    return null
  }

  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([]) // array of card ids
  const [previewCard, setPreviewCard] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/cards`)
        const data = await res.json()
        if (!cancelled) setCards(data)
      } catch (e) {
        console.error('Failed to load cards', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggleSelect = (card) => {
    if (card.taken) return
    setSelected((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id)
      }
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, card.id]
    })
  }

  const handleConfirmCards = async () => {
    const userId = localStorage.getItem('dbUserId') || 1
    try {
      await fetch(`${API_BASE}/api/rooms/${roomId}/select-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), cardIds: selected }),
      })
    } catch (e) {
      console.error('Failed to save selected cards', e)
    }
    localStorage.setItem('selectedCards', JSON.stringify(selected))
    localStorage.setItem('selectedCardIds', JSON.stringify(selected))
    localStorage.setItem('stake', stake)
    navigate(`/game?stake=${stake}&roomId=${roomId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#112A46] text-white flex items-center justify-center">
        Loading cards...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#112A46] text-white px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{stake} Birr Per Card</h1>
        <div className="flex items-center gap-2">
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')} className="bg-white text-[#112A46] text-xs font-bold px-2 py-1 rounded">
          {i18n.language === 'en' ? 'AM' : 'EN'}
        </button>
        <button className="text-yellow-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      </div>


      {/* Grid */}
      <div className="grid grid-cols-8 gap-2 mb-4">
        {cards.map((card) => {
          const isSelected = selected.includes(card.id)
          const isTaken = card.taken
          return (
            <button
              key={card.id}
              disabled={isTaken}
              onClick={() => {
                toggleSelect(card)
                setPreviewCard(card)
              }}
              className={`bingo-3d-box aspect-square flex items-center justify-center text-sm font-bold transition-colors ${
                isTaken
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                  : isSelected
                  ? 'bg-green-500 text-white'
                  : 'text-[#112A46]'
              }`}
            >
              {card.card_number}
            </button>
          )
        })}
      </div>

      {/* Confirm */}
      <button
        onClick={handleConfirmCards}
        disabled={selected.length === 0}
        className="w-full bg-green-500 text-white font-bold py-3 rounded-lg disabled:opacity-50"
      >
        Confirm Cards ({selected.length}/{MAX_SELECTION})
      </button>

      {/* Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[#112A46] font-bold">Card {previewCard.card_number}</h2>
              <button onClick={() => setPreviewCard(null)} className="text-gray-500 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {['B', 'I', 'N', 'G', 'O'].map((h) => (
                <div key={h} className="bg-[#112A46] text-white text-center font-bold py-1 rounded">
                  {h}
                </div>
              ))}
              {previewCard.matrix.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="bingo-3d-box aspect-square flex items-center justify-center text-[#112A46] font-bold text-sm"
                  >
                    {val === 0 ? 'FREE' : val}
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => {
                if (selected.includes(previewCard.id)) {
                  handleConfirmCards()
                } else {
                  toggleSelect(previewCard)
                  setPreviewCard(null)
                }
              }}
              className="w-full mt-3 bg-[#112A46] text-white font-bold py-2 rounded"
            >
              {selected.includes(previewCard.id) ? 'Confirm Cards' : 'Select Card'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

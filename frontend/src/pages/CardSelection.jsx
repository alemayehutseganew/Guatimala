import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function CardSelection() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const roomId = searchParams.get('roomId')
  const stake = searchParams.get('stake') || '10'

  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState({ slot1: null, slot2: null })
  const [previewCard, setPreviewCard] = useState(null)

  useEffect(() => {
    if (!roomId) {
      navigate('/')
      return
    }
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/cards`)
        const data = await res.json()
        if (!cancelled) setCards(data || [])
      } catch (e) {
        console.error('Failed to load cards', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [roomId, navigate])

  const handleAssignSlot = (slotNum, card) => {
    const key = slotNum === 1 ? 'slot1' : 'slot2'
    setSelectedSlots((prev) => {
      if (prev[key]?.id === card.id) {
        return { ...prev, [key]: null }
      }
      return { ...prev, [key]: card }
    })
  }

  const handleConfirmAndPlay = async () => {
    const selectedIds = [selectedSlots.slot1, selectedSlots.slot2]
      .filter(Boolean)
      .map((c) => c.id)

    if (selectedIds.length === 0) return

    const userId = localStorage.getItem('dbUserId') || 1
    try {
      await fetch(`${API_BASE}/api/rooms/${roomId}/select-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), cardIds: selectedIds }),
      })
    } catch (e) {
      console.error('Failed to save selected cards', e)
    }
    localStorage.setItem('selectedCards', JSON.stringify(selectedIds))
    localStorage.setItem('selectedCardIds', JSON.stringify(selectedIds))
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

  const slotLabel = (card) => {
    if (selectedSlots.slot1?.id === card.id) return 'Slot 1'
    if (selectedSlots.slot2?.id === card.id) return 'Slot 2'
    return null
  }

  return (
    <div className="min-h-screen bg-[#112A46] text-white px-4 py-4 pb-24">
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

      <div className="grid grid-cols-8 gap-2 mb-4">
        {cards.map((card) => {
          const label = slotLabel(card)
          const isAssigned = !!label
          return (
            <button
              key={card.id}
              onClick={() => setPreviewCard(card)}
              className={`bingo-3d-box aspect-square flex items-center justify-center text-sm font-bold transition-colors relative ${
                isAssigned ? 'ring-2 ring-green-500' : 'text-[#112A46]'
              }`}
            >
              {card.card_number}
              {label && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] font-bold px-1 rounded">
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#0d2238] p-3 flex items-center justify-between gap-2 z-40">
        <div className="text-xs">
          Slot 1: {selectedSlots.slot1 ? `Card ${selectedSlots.slot1.id}` : '—'} | Slot 2: {selectedSlots.slot2 ? `Card ${selectedSlots.slot2.id}` : '—'}
        </div>
        <button
          onClick={handleConfirmAndPlay}
          disabled={!selectedSlots.slot1 && !selectedSlots.slot2}
          className="bg-green-500 text-white font-bold px-4 py-2 rounded disabled:opacity-50"
        >
          Confirm & Play
        </button>
      </div>

      {previewCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-11/12 max-w-sm mx-auto shadow-2xl relative">
            <button onClick={() => setPreviewCard(null)} className="absolute top-3 right-3 text-gray-500 font-bold text-xl">
              ✕
            </button>

            <h3 className="text-xl font-bold text-[#112A46] mb-4 text-center">
              Card {previewCard?.id}
            </h3>

            <div className="grid grid-cols-5 gap-1 mb-2">
              <div className="bg-green-700 text-white font-bold py-1 rounded text-center">B</div>
              <div className="bg-yellow-500 text-white font-bold py-1 rounded text-center">I</div>
              <div className="bg-red-600 text-white font-bold py-1 rounded text-center">N</div>
              <div className="bg-green-500 text-white font-bold py-1 rounded text-center">G</div>
              <div className="bg-red-600 text-white font-bold py-1 rounded text-center">O</div>
            </div>

            <div className="grid grid-cols-5 gap-1 mb-6">
              {previewCard?.matrix?.flat().map((num, index) => {
                const isFree = index === 12 || num === 'FREE'
                return (
                  <div
                    key={index}
                    className={`aspect-square flex items-center justify-center font-bold text-sm rounded shadow-sm ${
                      isFree ? 'bg-blue-600 text-white' : 'bg-white text-black border-b-2 border-gray-300'
                    }`}
                  >
                    {isFree ? 'F' : num}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between gap-2 mt-4">
              <button
                onClick={() => { handleAssignSlot(1, previewCard); setPreviewCard(null) }}
                className={`flex-1 py-2 rounded font-bold ${selectedSlots.slot1?.id === previewCard.id ? 'bg-green-600 text-white' : 'bg-gray-300 text-black'}`}
              >
                {selectedSlots.slot1?.id === previewCard.id ? 'Slot 1 (Selected)' : 'Select for Slot 1'}
              </button>
              <button
                onClick={() => { handleAssignSlot(2, previewCard); setPreviewCard(null) }}
                className={`flex-1 py-2 rounded font-bold ${selectedSlots.slot2?.id === previewCard.id ? 'bg-green-600 text-white' : 'bg-gray-300 text-black'}`}
              >
                {selectedSlots.slot2?.id === previewCard.id ? 'Slot 2 (Selected)' : 'Select for Slot 2'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

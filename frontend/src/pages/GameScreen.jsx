import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useTranslation } from 'react-i18next'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function GameScreen() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const roomId = searchParams.get('roomId') || 'room_10'

  const [socket, setSocket] = useState(null)
  const [calledNumbers, setCalledNumbers] = useState([])
  const [countdown, setCountdown] = useState(5)
  const [currentLetter, setCurrentLetter] = useState('')
  const [currentBall, setCurrentBall] = useState(null)
  const [previousBalls, setPreviousBalls] = useState([])
  const [playerCount, setPlayerCount] = useState(0)
  const [card, setCard] = useState(null)
  const [markedNumbers, setMarkedNumbers] = useState(new Set())
  const [gameOver, setGameOver] = useState(false)
  const [isWinner, setIsWinner] = useState(false)
  const [winningPattern, setWinningPattern] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [autoSelect, setAutoSelect] = useState(false)

  const selectedRef = useRef([])

  useEffect(() => {
    const s = io(API_BASE, { transports: ['websocket'] })
    setSocket(s)

    let selectedIds = []
    try {
      selectedIds = JSON.parse(localStorage.getItem('selectedCardIds') || localStorage.getItem('selectedCards') || '[]')
    } catch (e) {}
    selectedRef.current = selectedIds

    const userId = localStorage.getItem('dbUserId') || 1
    fetch(`${API_BASE}/api/rooms/${roomId}/my-cards?userId=${userId}`)
      .then((r) => r.json())
      .then((cards) => {
        if (Array.isArray(cards) && cards.length) {
          // use first selected card's matrix
          setCard({ matrix: cards[0].matrix, card_number: cards[0].card_number })
        }
      })
      .catch(() => {})

    s.on('connect', () => {
      s.emit('join_room', { roomId, userId: null, cards: [] })
    })

    s.on('room_update', (data) => {
      setPlayerCount(data.playerCount)
      if (data.playerCount >= 2) {
        s.emit('start_game', { roomId })
      }
    })

    s.on('countdown_tick', (data) => {
      const t = (data && typeof data.timeLeft !== 'undefined') ? data.timeLeft : data
      setCountdown(t)
    })

    s.on('new_number_called', (data) => {
      const num = data.number
      setCurrentLetter(data.letter || '')
      setCurrentBall(num)
      setCalledNumbers(data.calledNumbers || [])
      setPreviousBalls((prev) => [num, ...prev].slice(0, 8))
    })

    s.on('game_over', (data) => {
      setGameOver(true)
      setIsWinner(data.winner && data.winner.socketId === s.id)
      setWinningPattern(data.pattern)
    })

    return () => {
      s.disconnect()
    }
  }, [roomId])

  const daub = (value) => {
    if (value === 'FREE' || value === 0) return
    if (!calledNumbers.includes(value)) return
    setMarkedNumbers((prev) => {
      const next = new Set(prev)
      next.add(value)
      return next
    })
  }

  const claimBingo = () => {
    if (!socket || !card) return
    socket.emit('claim_bingo', { roomId, card: card.matrix, markedNumbers: [...markedNumbers] })
  }

  const playAgain = () => {
    setGameOver(false)
    setCalledNumbers([])
    setCurrentBall(null)
    setPreviousBalls([])
    setMarkedNumbers(new Set())
    navigate('/')
  }

  const stake = localStorage.getItem('stake') || '10'

  return (
    <div className="min-h-screen bg-[#112A46] text-white p-2 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-2 text-xs">
        <div className="bg-white/10 px-2 py-1 rounded">Win: 0</div>
        <div className="bg-white/10 px-2 py-1 rounded">Stake: {stake}</div>
        <div className="bg-white/10 px-2 py-1 rounded">Call: {calledNumbers.length}</div>
        <div className="bg-white/10 px-2 py-1 rounded">Players: {playerCount}</div>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')} className="bg-white/10 px-2 py-1 rounded">
          {i18n.language === 'en' ? 'AM' : 'EN'}
        </button>
        <button onClick={() => setSoundOn((v) => !v)} className="bg-white/10 px-2 py-1 rounded">
          {soundOn ? 'SND' : 'MUTE'}
        </button>
        <button onClick={() => setAutoSelect((v) => !v)} className={`px-2 py-1 rounded ${autoSelect ? 'bg-green-500' : 'bg-white/10'}`}>
          Auto
        </button>
      </div>

      <div className="flex gap-2 mb-2 items-center">
        <div className={`flex-1 bg-white rounded-lg flex items-center justify-center h-24 border-4 ${
          currentLetter === 'B' ? 'border-blue-500' :
          currentLetter === 'I' ? 'border-red-500' :
          currentLetter === 'N' ? 'border-purple-500' :
          currentLetter === 'G' ? 'border-green-500' :
          currentLetter === 'O' ? 'border-yellow-400' : 'border-red-500'
        }`}>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-gray-500">{currentLetter}</span>
            <span className="text-[#112A46] text-4xl font-bold">
              {countdown > 0 && !currentBall ? countdown : (currentBall || '-')}
            </span>
          </div>
        </div>
        <div className="flex gap-1 items-center overflow-x-auto">
          {previousBalls.slice(0, 5).map((n, i) => {
            const l = n <= 15 ? 'B' : n <= 30 ? 'I' : n <= 45 ? 'N' : n <= 60 ? 'G' : 'O'
            const cls =
              l === 'B' ? 'border-blue-500' :
              l === 'I' ? 'border-red-500' :
              l === 'N' ? 'border-purple-500' :
              l === 'G' ? 'border-green-500' : 'border-yellow-400'
            return (
              <div key={i} className={`w-9 h-9 rounded-full bg-white border-2 ${cls} text-[#112A46] flex flex-col items-center justify-center text-[10px] font-bold`}>
                <span>{l}</span>
                <span>{n}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-2 flex-1">
        <div className="flex-1 grid grid-cols-5 gap-1 content-start">
          {[
            { label: 'B', nums: Array.from({ length: 15 }, (_, i) => i + 1) },
            { label: 'I', nums: Array.from({ length: 15 }, (_, i) => i + 16) },
            { label: 'N', nums: Array.from({ length: 15 }, (_, i) => i + 31) },
            { label: 'G', nums: Array.from({ length: 15 }, (_, i) => i + 46) },
            { label: 'O', nums: Array.from({ length: 15 }, (_, i) => i + 61) },
          ].map((col) => (
            <div key={col.label} className="flex flex-col gap-1">
              <div className={`text-center font-bold text-sm py-1 rounded ${
                col.label === 'B' ? 'bg-green-700' :
                col.label === 'I' ? 'bg-yellow-500' :
                col.label === 'N' ? 'bg-red-600' :
                col.label === 'G' ? 'bg-green-400' : 'bg-red-600'
              } text-white`}>
                {col.label}
              </div>
              {col.nums.map((n) => (
                <div
                  key={n}
                  className={`bingo-3d-box aspect-square flex items-center justify-center text-xs font-bold ${
                    calledNumbers.includes(n) ? 'bg-red-500 text-white' : 'text-[#112A46]'
                  }`}
                >
                  {n}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1">
          {card && (
            <div className="grid grid-cols-5 gap-1">
              {['B', 'I', 'N', 'G', 'O'].map((h) => (
                <div key={h} className={`text-center font-bold py-1 rounded text-sm ${h === 'B' ? 'bg-green-700' : h === 'I' ? 'bg-yellow-500' : h === 'N' ? 'bg-red-600' : h === 'G' ? 'bg-green-400' : 'bg-red-600'} text-white`}>
                  {h}
                </div>
              ))}
              {card.matrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isMarked = val === 'FREE' || val === 0 || markedNumbers.has(val)
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => daub(val)}
                      className={`bingo-3d-box aspect-square flex items-center justify-center text-sm font-bold ${
                        (rIdx === 2 && cIdx === 2)
                          ? 'bg-blue-500 text-white'
                          : isMarked
                          ? 'bg-green-500 text-white border-b-0 translate-y-1'
                          : 'text-[#112A46]'
                      }`}
                    >
                      {rIdx === 2 && cIdx === 2 ? 'F' : val}
                    </button>
                  )
                })
              )}
            </div>
          )}
          <button
            onClick={claimBingo}
            className="w-full mt-2 bg-yellow-400 text-[#112A46] font-bold py-3 rounded-full text-lg sticky bottom-0"
          >
            BINGO
          </button>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg p-6 w-full max-w-sm text-center ${isWinner ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            <h2 className="text-2xl font-bold mb-2">{isWinner ? 'You Won!' : 'You Lost'}</h2>
            {winningPattern && <p className="mb-4">Pattern: {winningPattern}</p>}
            <button onClick={playAgain} className="bg-white text-[#112A46] font-bold px-4 py-2 rounded">
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

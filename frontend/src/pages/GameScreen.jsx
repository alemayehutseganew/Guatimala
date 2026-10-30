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

    s.on('new_number_called', (data) => {
      const num = data.number
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

      <div className="flex gap-2 mb-2">
        <div className="flex-1 bg-white rounded-lg flex items-center justify-center h-24">
          <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center text-3xl font-bold">
            {currentBall || '-'}
          </div>
        </div>
        <div className="flex gap-1 items-center overflow-x-auto">
          {previousBalls.map((n, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gray-300 text-[#112A46] flex items-center justify-center text-xs font-bold">
              {n}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 flex-1">
        <div className="flex-1 grid grid-cols-5 gap-1 content-start">
          {Array.from({ length: 75 }, (_, i) => i + 1).map((n) => (
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

        <div className="flex-1">
          {card && (
            <div className="grid grid-cols-5 gap-1">
              {['B', 'I', 'N', 'G', 'O'].map((h) => (
                <div key={h} className="bg-[#112A46] text-yellow-400 text-center font-bold py-1 rounded text-sm">
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
                        isMarked ? 'bg-green-500 text-white' : 'text-[#112A46]'
                      }`}
                    >
                      {val === 0 || val === 'FREE' ? 'FREE' : val}
                    </button>
                  )
                })
              )}
            </div>
          )}
          <button
            onClick={claimBingo}
            className="w-full mt-2 bg-yellow-400 text-[#112A46] font-bold py-2 rounded"
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

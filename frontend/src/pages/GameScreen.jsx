import { useEffect, useState, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SocketService from '../services/socket';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const getBallColor = (letter) => {
  switch(letter) {
    case 'B': return 'bg-blue-700 border-blue-900';
    case 'I': return 'bg-red-600 border-red-800';
    case 'N': return 'bg-purple-600 border-purple-800';
    case 'G': return 'bg-green-600 border-green-800';
    case 'O': return 'bg-yellow-500 border-yellow-700';
    default: return 'bg-gray-500 border-gray-700';
  }
};

const GameScreen = () => {
  const socket = SocketService.get() || SocketService.connect()
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('roomId') || 'room_10';
  const stake = parseInt(searchParams.get('stake')) || 10;
  const userId = localStorage.getItem('dbUserId');

  const { i18n } = useTranslation();

  const [calledNumbers, setCalledNumbers] = useState([]);
  const [currentBall, setCurrentBall] = useState(null);
  const [calledHistory, setCalledHistory] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [cardsData, setCardsData] = useState([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [toast, setToast] = useState('');
  const [bingoMessage, setBingoMessage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fetch Cards from Backend
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/api/rooms/${roomId}/my-cards?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCardsData(data.map(c => ({ id: c.card_number, matrix: c.matrix })));
        }
      })
      .catch(err => console.error("Failed to fetch cards:", err));
  }, [roomId, userId]);

  // Socket Listeners
  useEffect(() => {
    if (!userId) return;

    const handleJoin = () => {
      socket.emit('join_room', { roomId, userId, stake });
      socket.emit('get_my_cards', { roomId, userId });
      console.log('Emitted join_room for:', roomId, userId);
    };

    if (socket.connected) {
      handleJoin();
    } else {
      socket.on('connect', handleJoin);
    }

    socket.on('room_update', (data) => setPlayersCount(data.players || data.playerCount || 0));
    socket.on('countdown_tick', (data) => setCountdown(data.timeLeft));
    socket.on('my_cards', (data) => {
      console.log("Received cards:", data);
      if (data.cards && data.cards.length > 0) {
        setCardsData(data.cards);
      }
    });

    socket.on('game_started', () => {
      setCountdown(null);
      setGameStarted(true);
    });

    socket.on('new_number_called', ({ number, letter }) => {
      setCurrentBall({ number, letter });
      setCalledNumbers(prev => [...prev, number]);
      setCalledHistory(prev => [...prev.slice(-4), { number, letter }]);
      if (soundEnabled) speakNumber(number, letter);
    });

    socket.on('game_over', (data) => {
      const isWinner = data.winner && (data.winner.userId === userId || data.winner.socketId === socket.id);
      setToast(isWinner ? "🎉 YOU WON! 🎉" : "Game Over. You lost.");
      setTimeout(() => setToast(''), 5000);
    });

    socket.on('bingo_result', (data) => {
      setBingoMessage(data);
      setTimeout(() => setBingoMessage(null), 4000);
    });

    return () => {
      socket.off('connect', handleJoin);
      socket.off('room_update');
      socket.off('countdown_tick');
      socket.off('my_cards');
      socket.off('game_started');
      socket.off('new_number_called');
      socket.off('game_over');
      socket.off('bingo_result');
    };
  }, [socket, roomId, userId, stake, soundEnabled]);

  const speakNumber = (number, letter) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const text = `${letter} ${number}`
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'am-ET'
    utterance.rate = 0.9
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  const handleDaub = (num) => {
    if (!calledNumbers.includes(num)) return;
    if (markedNumbers.includes(num)) return;
    setMarkedNumbers(prev => [...prev, num]);
  };

  const handleBingoClick = () => {
    if (!gameStarted) return;
    
    const cardId = cardsData[0]?.id || cardsData[0]?.cardId;
    if (!cardId) {
      console.error("No cardId found to claim!");
      return;
    }

    socket.emit('claim_bingo', { 
      roomId, 
      userId: localStorage.getItem('dbUserId'), 
      cardId, 
      markedNumbers 
    });
  };

  return (
    <div className="min-h-screen bg-[#1e3a5f] text-white p-2 font-sans flex flex-col">
      
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 mb-4 bg-[#112A46] p-2 rounded-md shadow-md">
        <div className="flex gap-2 text-xs font-bold">
          <div className="bg-[#2A4B6E] px-3 py-1 rounded">Win: 0</div>
          <div className="bg-[#2A4B6E] px-3 py-1 rounded">Stake: {stake}</div>
          <div className="bg-[#2A4B6E] px-3 py-1 rounded">Call: {calledNumbers.length}</div>
          <div className="bg-[#2A4B6E] px-3 py-1 rounded">Players: {playersCount}</div>
        </div>
        <div className="flex gap-1 text-xs">
          {/* AM Button */}
          <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'am' : 'en')}
            className="bg-[#2A4B6E] px-3 py-1 rounded hover:bg-[#3A5B7E]"
          >
            {i18n.language === 'en' ? 'AM' : 'EN'}
          </button>
          
          {/* SND Button */}
          <button 
            onClick={() => {
              if (soundEnabled) window.speechSynthesis?.cancel()
              setSoundEnabled(!soundEnabled)
            }}
            className={`px-3 py-1 rounded ${soundEnabled ? 'bg-green-600' : 'bg-[#2A4B6E]'}`}
          >
            {soundEnabled ? 'SND' : 'MUTE'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-row gap-2 flex-1">
        
        {/* LEFT COLUMN: Tracker & Ball */}
        <div className="w-1/2 flex flex-col gap-4">
          
          {/* Large Ball Area */}
          <div className="w-full h-40 bg-white border-4 border-red-600 rounded-lg flex items-center justify-center shadow-inner">
            {countdown !== null ? (
              <span className="text-7xl font-bold text-[#112A46]">{countdown}</span>
            ) : currentBall ? (
              <div className={`w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center shadow-xl ${getBallColor(currentBall.letter)}`}>
                <span className="text-2xl font-bold text-white mt-1 ibm-plex-mono-bold-italic">
                  {currentBall.letter}
                </span>
                <span className="text-6xl font-bold text-white">{currentBall.number}</span>
              </div>
            ) : (
              <span className="text-gray-400 font-bold">Waiting for game...</span>
            )}
          </div>

          {/* Previous Balls */}
          <div className="flex gap-2 justify-center h-10">
            {calledHistory.map((ball, i) => (
              <div key={i} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${getBallColor(ball.letter)}`}>
                {ball.number}
              </div>
            ))}
          </div>

          {/* 1-75 Tracker */}
          <div className="bg-[#4a5568] p-2 rounded-lg shadow-md">
            <div className="grid grid-cols-5 gap-1">
              {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                <div key={letter} className={`text-center text-xl py-1 rounded text-white ibm-plex-mono-bold-italic ${getBallColor(letter).split(' ')[0]}`}>
                  {letter}
                </div>
              ))}
              {Array.from({ length: 15 }, (_, rowIndex) => (
                <Fragment key={rowIndex}>
                  {[0, 1, 2, 3, 4].map((colIndex) => {
                    const num = rowIndex + 1 + (colIndex * 15);
                    const isCalled = calledNumbers.includes(num);
                    return (
                      <div 
                        key={num} 
                        className={`text-center text-sm py-1.5 rounded ${isCalled ? 'bg-red-500 text-white font-bold' : 'bg-[#1e3a5f] text-white'}`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Player Card */}
        <div className="w-1/2 flex flex-col justify-center items-center gap-4 py-10">
          <div className="w-full flex flex-col items-center gap-4">

          {cardsData && cardsData.length > 0 ? (
            <div className="bg-[#4a5568] p-3 rounded-xl shadow-lg">
              <div className="text-center font-bold text-lg mb-2 text-gray-200">
                Card No. {cardsData[0]?.id || '?'}
              </div>
              
              <div className="grid grid-cols-5 gap-1 mb-2">
                {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                  <div key={letter} className={`text-center text-xl py-1 rounded text-white ibm-plex-mono-bold-italic ${getBallColor(letter).split(' ')[0]}`}>
                    {letter}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1">
                {cardsData[0]?.matrix?.flat().map((num, index) => {
                  const isFree = index === 12 || num === 'FREE';
                  const isMarked = isFree || markedNumbers.includes(num);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => !isFree && handleDaub(num)}
                      className={`aspect-square flex items-center justify-center font-bold text-lg rounded-md shadow-sm transition-transform
                        ${isFree ? 'bg-blue-600 text-white border-b-0 transform translate-y-1' : 
                          isMarked ? 'bg-green-500 text-white border-b-0 transform translate-y-1' : 
                          'bg-white text-black border-b-4 border-gray-300 hover:bg-gray-100'}`}
                    >
                      {isFree ? 'F' : num}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-white text-center mt-10">Loading Card...</div>
          )}

          <button 
            onClick={handleBingoClick}
            className="w-full max-w-sm bg-yellow-500 text-[#112A46] font-extrabold text-2xl py-4 rounded-xl shadow-lg"
          >
            BINGO
          </button>
          </div>

        </div>
      </div>
      
      {bingoMessage && (
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-xl shadow-2xl font-bold text-center z-50 ${bingoMessage.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {bingoMessage.message}
        </div>
      )}

      {toast && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white text-3xl font-bold p-8 rounded-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
};

export default GameScreen;
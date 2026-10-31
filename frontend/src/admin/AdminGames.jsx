import { useEffect, useState } from 'react';

export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/games`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.games) setGames(data.games);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  if (loading) return <div className="text-white p-6">Loading games...</div>;

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-6">Game History</h1>
      
      <div className="overflow-x-auto w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
        <table className="w-full text-left text-sm text-slate-300 min-w-[800px]">
          <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-400">
            <tr>
              <th className="px-6 py-4">Room ID</th>
              <th className="px-6 py-4">Stake</th>
              <th className="px-6 py-4">Players</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Winner</th>
              <th className="px-6 py-4">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {games.map((game) => (
              <tr key={game.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-slate-400">
                  ...{game.id.slice(-6)}
                </td>
                <td className="px-6 py-4 font-bold text-green-400">
                  {game.stake_amount} ETB
                </td>
                <td className="px-6 py-4">{game.total_players}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    game.status === 'FINISHED' ? 'bg-green-900 text-green-300' :
                    game.status === 'PLAYING' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-600 text-gray-300'
                  }`}>
                    {game.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-yellow-400">
                  {game.winner_name}
                </td>
                <td className="px-6 py-4 text-sm">
                  {new Date(game.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {games.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No games played yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
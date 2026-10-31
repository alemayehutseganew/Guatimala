import { Outlet, useNavigate } from 'react-router-dom'

export default function AdminLayout() {
  const navigate = useNavigate()
  const logout = () => {
    localStorage.removeItem('adminToken')
    navigate('/admin/login')
  }
  const links = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/games', label: 'Games' },
    { to: '/admin/payments', label: 'Payments' },
  ]
  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <aside className="w-56 bg-gray-800 p-4 space-y-2">
        <h2 className="text-xl font-bold mb-4">Admin</h2>
        {links.map((l) => (
          <button
            key={l.to}
            onClick={() => navigate(l.to)}
            className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700"
          >
            {l.label}
          </button>
        ))}
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 p-4 flex justify-end">
          <button onClick={logout} className="bg-red-600 px-3 py-1 rounded">Logout</button>
        </header>
        <main className="p-6 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

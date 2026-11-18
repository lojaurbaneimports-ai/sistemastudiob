import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Moon, Sun, Search, Menu, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/ponto/registro', label: 'Ponto - Registro', icon: '⏱️' },
  { to: '/ponto/colaboradores', label: 'Colaboradores', icon: '👥' },
  { to: '/contatos', label: 'Clientes/Fornecedores', icon: '📇' },
  { to: '/produtos', label: 'Produtos', icon: '📦' },
  { to: '/estoque', label: 'Estoque', icon: '📋' },
  { to: '/pdv', label: 'PDV Caixa', icon: '🛒' },
  { to: '/orcamentos', label: 'Orçamentos', icon: '📝' },
  { to: '/os', label: 'Ordens de Serviço', icon: '🔧' },
  { to: '/financeiro', label: 'Financeiro', icon: '💰' },
  { to: '/relatorios', label: 'Relatórios', icon: '📈' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const loc = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/ponto/registro': 'Registro de Ponto',
    '/ponto/colaboradores': 'Colaboradores',
    '/contatos': 'Clientes e Fornecedores',
    '/produtos': 'Produtos',
    '/estoque': 'Estoque',
    '/pdv': 'PDV Caixa',
    '/orcamentos': 'Orçamentos',
    '/os': 'Ordens de Serviço',
    '/financeiro': 'Financeiro',
    '/relatorios': 'Relatórios',
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r bg-card transition-all flex flex-col`}>
        <div className="flex items-center justify-between p-3 border-b">
          {!collapsed && <span className="font-bold text-lg">ERP</span>}
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`
              }
            >
              <span>{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center gap-3 px-4 bg-card">
          <h1 className="font-semibold text-lg">{titles[loc.pathname] || 'ERP'}</h1>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Busca rápida..." className="pl-8" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDark(!dark)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

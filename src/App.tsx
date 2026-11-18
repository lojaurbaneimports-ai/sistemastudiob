import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Employees from '@/pages/Employees'
import TimeClock from '@/pages/TimeClock'
import Contacts from '@/pages/Contacts'
import Products from '@/pages/Products'
import Stock from '@/pages/Stock'
import PDV from '@/pages/PDV'
import Quotes from '@/pages/Quotes'
import ServiceOrders from '@/pages/ServiceOrders'
import Financial from '@/pages/Financial'
import Reports from '@/pages/Reports'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ponto/colaboradores" element={<Employees />} />
              <Route path="/ponto/registro" element={<TimeClock />} />
              <Route path="/contatos" element={<Contacts />} />
              <Route path="/produtos" element={<Products />} />
              <Route path="/estoque" element={<Stock />} />
              <Route path="/pdv" element={<PDV />} />
              <Route path="/orcamentos" element={<Quotes />} />
              <Route path="/os" element={<ServiceOrders />} />
              <Route path="/financeiro" element={<Financial />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

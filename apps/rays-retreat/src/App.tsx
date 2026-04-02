import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import HomePage from './pages/HomePage';
import SubmitPage from './pages/SubmitPage';
import CheckoutPage from './pages/CheckoutPage';
import StatusPage from './pages/StatusPage';
import ReportPage from './pages/ReportPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface text-ink antialiased">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/status/:batchId" element={<StatusPage />} />
            <Route path="/report/:batchId" element={<ReportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

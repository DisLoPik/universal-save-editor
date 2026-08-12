import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './ui/components/Header';
import { Footer } from './ui/components/Footer';
import { HomePage } from './ui/pages/HomePage';
import { SupportedGamesPage } from './ui/pages/SupportedGamesPage';
import { DocsPage } from './ui/pages/DocsPage';
import { AboutPage } from './ui/pages/AboutPage';
import { useSchemasStore } from './app/schemas-store';
import { useSettingsStore } from './app/settings-store';

export function App() {
  const load = useSchemasStore((s) => s.load);
  const schemaBaseUrl = useSettingsStore((s) => s.schemaBaseUrl);

  useEffect(() => {
    load(schemaBaseUrl);
  }, [load, schemaBaseUrl]);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/supported-games" element={<SupportedGamesPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { api, type User } from './api';
import Login from './Login';
import Gallery from './Gallery';
import ShareView from './ShareView';

// The owner's app: checks login, then shows Login or the Gallery.
function VaultApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }
  if (!user) return <Login onAuthed={setUser} />;
  return <Gallery onLogout={() => setUser(null)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public share links — no login required. */}
        <Route path="/s/:token" element={<ShareView />} />
        {/* Everything else is the owner's app. */}
        <Route path="*" element={<VaultApp />} />
      </Routes>
    </BrowserRouter>
  );
}

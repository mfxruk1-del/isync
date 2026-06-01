import { useEffect, useState } from 'react';
import { api, type User } from './api';
import Login from './Login';
import Gallery from './Gallery';

export default function App() {
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
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) return <Login onAuthed={setUser} />;
  return <Gallery user={user} onLogout={() => setUser(null)} />;
}

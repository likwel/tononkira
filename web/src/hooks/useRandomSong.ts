import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, songPath } from '../lib/api';

/** « Une chanson au hasard » : demande une chanson à l'API puis y navigue. */
export function useRandomSong() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      navigate(songPath(await api.randomSong()));
    } catch {
      // Catalogue vide ou API injoignable : le bouton reste simplement disponible.
    } finally {
      setLoading(false);
    }
  }

  return { go, loading };
}

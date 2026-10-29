import { Heart, House, MicVocal, Music } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/hira', label: 'Chansons', icon: Music, end: false },
  { to: '/mpihira', label: 'Artistes', icon: MicVocal, end: false },
  { to: '/ankafizina', label: 'Favoris', icon: Heart, end: false },
] as const;

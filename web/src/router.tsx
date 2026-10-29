import { createBrowserRouter } from 'react-router';
import { AdminLayout } from './admin/AdminLayout';
import { CrawlPagesPage } from './admin/pages/CrawlPagesPage';
import { JobsPage } from './admin/pages/JobsPage';
import { ListPagesPage } from './admin/pages/ListPagesPage';
import { OverviewPage } from './admin/pages/OverviewPage';
import { Layout } from './components/layout/Layout';
import { ArtistPage } from './pages/ArtistPage';
import { ArtistsPage } from './pages/ArtistsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage';
import { SearchPage } from './pages/SearchPage';
import { SongPage } from './pages/SongPage';
import { SongsPage } from './pages/SongsPage';

/** Les chemins reprennent le vocabulaire malagasy : hira (chansons), mpihira (artistes), karoka (recherche), ankafizina (favoris). */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'hira', element: <SongsPage /> },
      { path: 'hira/:artistSlug/:slug', element: <SongPage /> },
      { path: 'mpihira', element: <ArtistsPage /> },
      { path: 'mpihira/:slug', element: <ArtistPage /> },
      { path: 'karoka', element: <SearchPage /> },
      { path: 'ankafizina', element: <FavoritesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Administration : collecte, historique et mises à jour (hors navigation publique).
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'pages', element: <CrawlPagesPage /> },
      { path: 'listes', element: <ListPagesPage /> },
      { path: 'taches', element: <JobsPage /> },
    ],
  },
]);

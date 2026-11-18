import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createBrowserRouter, Navigate, RouterProvider} from 'react-router';
import {setNavigate, useServerEvents} from './api/events.ts';
import {Layout} from './shell/Layout.tsx';
import {EditorScreen} from './screens/Editor/Editor.tsx';
import {LibraryScreen} from './screens/Library/Library.tsx';
import {ProjectsScreen} from './screens/Projects/Projects.tsx';
import {RendersScreen} from './screens/Renders/Renders.tsx';
import {SettingsScreen} from './screens/Settings/Settings.tsx';
import {UiGallery} from './screens/UiGallery/UiGallery.tsx';
import {VoicesScreen} from './screens/Voices/Voices.tsx';
import {ThemeProvider, Toaster} from './ui/index.ts';

const queryClient = new QueryClient({defaultOptions: {queries: {staleTime: 5_000, refetchOnWindowFocus: false, retry: 1}}});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {path: '/', element: <ProjectsScreen />},
      {path: '/p/:slug', element: <EditorScreen />},
      {path: '/p/:slug/renders', element: <RendersScreen />},
      {path: '/library', element: <LibraryScreen />},
      {path: '/voices', element: <VoicesScreen />},
      {path: '/settings', element: <SettingsScreen />},
      {path: '/ui', element: <UiGallery />},
      {path: '*', element: <Navigate to="/" replace />},
    ],
  },
]);
setNavigate((to) => void router.navigate(to, {viewTransition: true}));

function Events(): null { useServerEvents(); return null; }

export const App = (): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <Events />
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </QueryClientProvider>
);

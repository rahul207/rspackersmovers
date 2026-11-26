import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ConsentProvider } from './features/consent/ConsentProvider';
import { QuoteDraftProvider } from './features/booking/QuoteDraftProvider';
import { Layout } from './features/site/Layout';
import { SiteConfigProvider } from './features/site/SiteConfigProvider';
import HomePage from './pages/HomePage';

const PolicyPlaceholderPage = lazy(() => import('./pages/PolicyPlaceholderPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const POLICY_ROUTES = [
  '/privacy',
  '/cookie-policy',
  '/terms',
  '/cancellation-policy',
  '/data-request',
];

function PageFallback() {
  return (
    <div className="container-page py-16" role="status" aria-label="Loading page">
      <div className="skeleton h-9 w-64" />
      <div className="skeleton mt-6 h-32 w-full max-w-2xl" />
    </div>
  );
}

export default function App() {
  return (
    <SiteConfigProvider>
      <ConsentProvider>
        <QuoteDraftProvider>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                {POLICY_ROUTES.map((path) => (
                  <Route key={path} path={path} element={<PolicyPlaceholderPage />} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </QuoteDraftProvider>
      </ConsentProvider>
    </SiteConfigProvider>
  );
}

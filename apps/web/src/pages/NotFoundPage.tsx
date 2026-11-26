import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="container-page max-w-2xl py-20 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">We could not find that page</h1>
      <p className="mt-3 text-slate-700">The link may be broken or the page may have moved.</p>
      <p className="mt-8">
        <Link to="/" className="btn-primary">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}

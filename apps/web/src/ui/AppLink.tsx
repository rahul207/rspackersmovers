import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AppLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

/** Router link for internal paths, plain anchor for absolute URLs. */
export function AppLink({ href, className, children, onClick }: AppLinkProps) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

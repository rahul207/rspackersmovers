import type { ReactNode } from 'react';

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  className?: string;
}

export function SectionHeading({ id, eyebrow, title, lead, className = '' }: SectionHeadingProps) {
  return (
    <div className={className}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="section-title mt-2">
        {title}
      </h2>
      {lead ? <div className="section-lead">{lead}</div> : null}
    </div>
  );
}

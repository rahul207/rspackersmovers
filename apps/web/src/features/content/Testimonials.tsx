import { SectionHeading } from '../../ui/SectionHeading';
import { StarIcon } from '../../ui/Icons';
import { ContentGate } from './ContentGate';

/** DEMONSTRATION CONTENT: testimonials come from fictional seed data and are not real customers. */
export default function Testimonials() {
  return (
    <div className="bg-navy-50">
      <div className="container-page py-16 sm:py-20">
        <SectionHeading
          id="testimonials-title"
          eyebrow="Testimonials"
          title="What customers might say"
        />
        <p className="mt-4 inline-flex rounded-xl border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Demonstration content — fictional. These are sample testimonials, not verified customer
          reviews.
        </p>
        <ContentGate>
          {(content) => (
            <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {content.testimonials.map((t) => (
                <li key={t.id}>
                  <figure className="card flex h-full flex-col p-6">
                    <div className="flex items-center gap-1 text-action-strong">
                      {Array.from({ length: 5 }, (_, i) => (
                        <StarIcon key={i} size={18} className={i < t.rating ? '' : 'opacity-25'} />
                      ))}
                      <span className="sr-only">{t.rating} out of 5 stars (sample rating)</span>
                    </div>
                    <blockquote className="mt-3 flex-1 text-slate-800">“{t.quote}”</blockquote>
                    <figcaption className="mt-4 text-sm">
                      <span className="block font-bold">{t.author}</span>
                      <span className="block text-slate-700">{t.role}</span>
                      <span className="badge-demo mt-2">Demonstration content — fictional</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )}
        </ContentGate>
      </div>
    </div>
  );
}

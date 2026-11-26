import { ChevronDownIcon } from '../../ui/Icons';
import { SectionHeading } from '../../ui/SectionHeading';
import { ContentGate } from './ContentGate';

export default function Faq() {
  return (
    <div className="container-page max-w-4xl py-16 sm:py-20">
      <SectionHeading id="faq-title" eyebrow="FAQ" title="Frequently asked questions" />
      <ContentGate>
        {(content) => (
          <div className="mt-8 space-y-3">
            {content.faqs.map((faq) => (
              <details key={faq.id} className="faq card">
                <summary>
                  <span>{faq.question}</span>
                  <ChevronDownIcon className="chevron" />
                </summary>
                <p className="px-4 pb-4 text-slate-700">{faq.answer}</p>
              </details>
            ))}
          </div>
        )}
      </ContentGate>
    </div>
  );
}

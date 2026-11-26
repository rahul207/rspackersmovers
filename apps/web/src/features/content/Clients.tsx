import { SectionHeading } from '../../ui/SectionHeading';
import { ContentGate } from './ContentGate';

/*
 * DEMONSTRATION CONTENT: the client names below come from the API's seed data and are
 * FICTIONAL. They are rendered as neutral typographic monograms (no real company logos).
 * Replace them with real, permitted client references before going to production.
 */
export default function Clients() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        id="clients-title"
        eyebrow="Clients"
        title="Trusted by businesses and families"
      />
      <p className="mt-4 inline-flex rounded-xl border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Demonstration content — fictional. These client names are placeholders and will be replaced
        before launch.
      </p>
      <ContentGate>
        {(content) => (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {content.clients.map((client) => (
              <li key={client.id} className="card flex flex-col items-center gap-3 p-5 text-center">
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-xl bg-navy-900 text-lg font-extrabold text-white"
                >
                  {client.monogram}
                </span>
                <span className="text-sm font-semibold">{client.name}</span>
                <span className="badge-demo">Fictional</span>
              </li>
            ))}
          </ul>
        )}
      </ContentGate>
    </div>
  );
}

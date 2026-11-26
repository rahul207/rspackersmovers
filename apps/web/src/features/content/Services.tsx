import { SectionHeading } from '../../ui/SectionHeading';
import { ServiceIcon } from '../../ui/Icons';
import { ContentGate } from './ContentGate';

export default function Services() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        id="services-title"
        eyebrow="Services"
        title="Moving and courier services for every need"
        lead="From a single parcel to a full office relocation, tell us what you are moving and we will suggest the right vehicle and team."
      />
      <ContentGate>
        {(content) => (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.services.map((service) => (
              <li key={service.id} className="card p-6">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy-900 text-white">
                  <ServiceIcon name={service.icon} size={26} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{service.title}</h3>
                <p className="mt-2 text-slate-700">{service.description}</p>
              </li>
            ))}
          </ul>
        )}
      </ContentGate>
    </div>
  );
}

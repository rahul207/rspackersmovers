import { SectionHeading } from '../../ui/SectionHeading';
import { ShieldIcon } from '../../ui/Icons';

const POINTS = [
  {
    title: 'Safety and handling process',
    text: 'Goods are checked, wrapped and loaded with care, and vehicles are matched to the size and type of your load.',
  },
  {
    title: 'Trained staff',
    text: 'Helpers can be added to your request. Tell us about stairs, fragile items or heavy furniture so we can plan the right team.',
  },
  {
    title: 'Personal quotations',
    text: 'Your quotation is prepared by our team after they review your requirements - no automatic prices, no surprises.',
  },
  {
    title: 'Customer-support commitment',
    text: 'You deal with a real team that confirms the details with you, answers questions and keeps you informed.',
  },
];

export default function About() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading id="about-title" eyebrow="About us" title="About RS Packers & Movers" />

      <FounderProfile />

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6 text-lg text-slate-700">
          <div>
            <h3 className="text-xl font-bold text-navy-900">Company overview</h3>
            <p className="mt-2">
              RS Packers &amp; Movers helps households, offices and businesses with packing, moving,
              vehicle transport and courier services. We aim to make relocation simple to request
              and easy to understand.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold text-navy-900">Our mission</h3>
            <p className="mt-2">
              To move your belongings safely and on time, with honest quotations and clear
              communication at every step.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold text-navy-900">Service area</h3>
            <p className="mt-2">
              We handle local moves and intercity or interstate relocation. Share your pickup and
              drop locations and our team will confirm whether and how we can serve them.
            </p>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {POINTS.map((point) => (
            <li key={point.title} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-white">
                <ShieldIcon size={22} />
              </span>
              <h3 className="mt-3 text-base font-bold">{point.title}</h3>
              <p className="mt-1.5 text-sm text-slate-700">{point.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const HAS_FOUNDER_PHOTO = import.meta.env.VITE_HAS_FOUNDER_PHOTO === 'true';

/**
 * Founder profile: a short, personal message from Jyotikanta Das alongside a brief bio.
 * Statements describe his approach and experience; no business performance claims are made here.
 */
function FounderProfile() {
  return (
    <section aria-labelledby="founder-title" className="card mt-10 overflow-hidden p-0 sm:mt-12">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,15rem)_1fr]">
        {HAS_FOUNDER_PHOTO ? (
          <picture>
            <source type="image/webp" srcSet="/brand/founder.webp" media="(min-width: 640px)" />
            <img
              src="/brand/founder.jpg"
              width={960}
              height={993}
              alt="Jyotikanta Das, Founder of RS Packers & Movers, in his office"
              loading="lazy"
              decoding="async"
              className="h-56 w-full object-cover object-top sm:h-full"
            />
          </picture>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-56 items-center justify-center bg-navy-100 text-5xl font-extrabold text-navy-400 sm:h-full"
          >
            JD
          </div>
        )}
        <div className="p-6 sm:p-8">
          <p className="eyebrow">Message from our founder</p>
          <h3 id="founder-title" className="mt-1 text-2xl font-extrabold text-navy-900">
            Jyotikanta Das
          </h3>
          <p className="text-sm font-semibold text-coral-strong">
            Founder, RS Packers &amp; Movers &middot; 18+ years in packing, moving &amp; logistics
          </p>
          <blockquote className="section-lead mt-4 border-l-4 border-action pl-4 text-slate-800 italic">
            &ldquo;I have never believed in standing apart from my team or speaking louder than the
            work itself. I would rather be on the ground with our staff, solving problems together,
            because that is how a move actually succeeds.&rdquo;
          </blockquote>
          <p className="mt-4 text-slate-700">
            With close to two decades of hands-on experience in the packing and moving industry,
            Jyotikanta Das founded RS Packers &amp; Movers on a simple, unassuming principle: quiet,
            consistent effort matters more than appearances. He stays closely involved in day-to-day
            operations, working alongside employees rather than above them, and is known for being
            disciplined, sincere and dependable in every commitment he makes to customers and staff
            alike.
          </p>
        </div>
      </div>
    </section>
  );
}

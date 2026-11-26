import { SectionHeading } from '../../ui/SectionHeading';

const STEPS = [
  {
    title: 'Enter pickup and drop PIN codes',
    text: 'Type the 6-digit PIN codes and choose your area from the list.',
  },
  {
    title: 'Select service and vehicle',
    text: 'Pick the type of move and the vehicle that suits your load.',
  },
  {
    title: 'Add your full pickup and drop addresses',
    text: 'Type the house or flat number, building, street and a nearby landmark.',
  },
  {
    title: 'Send your request on WhatsApp',
    text: 'Send your details to our team in one tap. No payment is taken online.',
  },
  {
    title: 'Receive your quotation and confirmation from the operations team',
    text: 'Our team reviews your request and prepares your quotation personally.',
  },
];

export default function HowItWorks() {
  return (
    <div className="bg-navy-50">
      <div className="container-page py-16 sm:py-20">
        <SectionHeading
          id="how-it-works-title"
          eyebrow="How it works"
          title="Five simple steps from request to confirmation"
        />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card relative p-5">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-full bg-action text-lg font-extrabold text-navy-900"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-bold">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

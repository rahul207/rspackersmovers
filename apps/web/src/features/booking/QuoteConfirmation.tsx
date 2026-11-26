import { useEffect, useRef, useState } from 'react';
import type { QuoteCreated } from '@rs/shared';
import { copyText } from '../../lib/clipboard';
import { isSafeWhatsappUrl } from '../../lib/whatsapp';
import { CheckIcon, WhatsappIcon } from '../../ui/Icons';
import { splitPhones } from '../../lib/format';
import { useSiteConfig } from '../site/siteConfigContext';

interface Props {
  result: QuoteCreated;
  onReset: () => void;
}

const PRINT_BODY_CLASS = 'quote-confirmation-open';

export function QuoteConfirmation({ result, onReset }: Props) {
  const { referenceNumber, whatsapp } = result;
  const { business } = useSiteConfig();
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const url = isSafeWhatsappUrl(whatsapp.url) ? whatsapp.url : undefined;

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Tells the print stylesheet that only this card should be printed.
  useEffect(() => {
    document.body.classList.add(PRINT_BODY_CLASS);
    return () => document.body.classList.remove(PRINT_BODY_CLASS);
  }, []);

  const printCard = () => {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    // The browser proposes the page title as the file name when saving as PDF.
    document.title = `Quote request ${referenceNumber}`;
    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  const copy = async () => {
    const ok = await copyText(whatsapp.message, textareaRef.current);
    setCopyStatus(
      ok ? 'Message copied' : 'Could not copy automatically. Please select the text and copy it.',
    );
  };

  return (
    <div
      ref={cardRef}
      role="status"
      tabIndex={-1}
      aria-labelledby="quote-confirmation-title"
      className="quote-confirmation space-y-4 rounded-2xl border-2 border-navy-900 bg-white p-5"
    >
      <div className="print-only">
        <p className="print-business">{business.name}</p>
        <p className="print-title">Quote request</p>
      </div>
      <div className="flex items-start gap-3">
        <span className="no-print grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
          <CheckIcon size={20} />
        </span>
        <div>
          <h3 id="quote-confirmation-title" className="text-xl font-extrabold">
            Request received
          </h3>
          <p className="mt-0.5 text-sm text-slate-700">
            Your reference number is{' '}
            <strong className="text-base text-navy-900 select-all">{referenceNumber}</strong>
          </p>
        </div>
      </div>

      <p className="no-print rounded-xl border border-navy-200 bg-navy-50 p-4 text-sm font-medium text-navy-900">
        Send the pre-filled message on WhatsApp and our team will share your quotation there.
      </p>

      {url ? (
        <div className="no-print">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full sm:w-auto"
          >
            <WhatsappIcon size={20} />
            Open WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="mt-2 text-sm text-slate-700">
            We tried to open WhatsApp for you. If nothing opened (pop-up blockers can stop this),
            use the button above or copy the message below and send it to us yourself.
          </p>
        </div>
      ) : (
        <p className="no-print rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          A WhatsApp number has not been configured for this site yet, so we cannot open WhatsApp
          for you. Your request has still been saved. You can copy the message below and share it
          with us another way.
        </p>
      )}

      <div>
        <label htmlFor="quote-whatsapp-message" className="no-print text-sm font-semibold">
          Your WhatsApp message
        </label>
        <textarea
          id="quote-whatsapp-message"
          ref={textareaRef}
          readOnly
          rows={8}
          value={whatsapp.message}
          className="no-print input mt-1.5 font-mono text-sm"
        />
        <p className="print-only print-message">{whatsapp.message}</p>
        <div className="no-print mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={copy}>
            Copy message
          </button>
          <button type="button" className="btn-outline" onClick={printCard}>
            Download as PDF
          </button>
          <button type="button" className="btn-navy" onClick={onReset}>
            Start a new request
          </button>
        </div>
        <p className="no-print mt-2 text-sm text-slate-700">
          In the print window choose &lsquo;Save as PDF&rsquo;.
        </p>
        <div
          role="status"
          aria-live="polite"
          className="no-print mt-2 min-h-5 text-sm font-medium text-navy-700"
        >
          {copyStatus}
        </div>
      </div>

      <div className="print-only print-contact">
        <p>
          <strong>{business.name}</strong>
        </p>
        {business.phone ? <p>Phone: {splitPhones(business.phone).join(', ')}</p> : null}
        {business.email ? <p>Email: {business.email}</p> : null}
      </div>
    </div>
  );
}

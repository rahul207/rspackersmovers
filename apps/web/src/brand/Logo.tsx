interface LogoProps {
  /** Use on navy backgrounds. */
  onDark?: boolean;
  className?: string;
}

const hasLogo = import.meta.env.VITE_HAS_LOGO === 'true';
const logoHeight = Number(import.meta.env.VITE_LOGO_HEIGHT ?? 48) || 48;
const logoWidth = Number(import.meta.env.VITE_LOGO_WIDTH ?? 160) || 160;
const NAME = 'RS Packers & Movers';
const NOMINAL_HEIGHT = 48;

/** Real logo when the asset pipeline has produced one; otherwise an accessible text wordmark. */
export function Logo({ onDark = false, className = '' }: LogoProps) {
  if (hasLogo) {
    const width = Math.round((logoWidth / logoHeight) * NOMINAL_HEIGHT);
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <picture>
          <source
            type="image/webp"
            srcSet="/brand/logo-1x.webp 1x, /brand/logo-2x.webp 2x, /brand/logo-4x.webp 4x"
          />
          <img
            src="/brand/logo-1x.png"
            srcSet="/brand/logo-1x.png 1x, /brand/logo-2x.png 2x, /brand/logo-4x.png 4x"
            width={width}
            height={NOMINAL_HEIGHT}
            alt=""
            decoding="async"
            className={`block h-11 w-auto max-w-[20vw] rounded-full ${onDark ? 'ring-2 ring-white/70' : 'ring-1 ring-navy-100'}`}
          />
        </picture>
        <span
          className={`hidden text-base leading-tight font-extrabold sm:inline ${onDark ? 'text-white' : 'text-navy-900'}`}
        >
          {NAME}
        </span>
        <span className="sr-only">{NAME}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold tracking-tight ${
          onDark ? 'bg-white text-navy-900' : 'bg-navy-900 text-white'
        }`}
      >
        RS
      </span>
      <span
        className={`text-base leading-tight font-extrabold sm:text-lg ${onDark ? 'text-white' : 'text-navy-900'}`}
      >
        {NAME}
      </span>
    </span>
  );
}

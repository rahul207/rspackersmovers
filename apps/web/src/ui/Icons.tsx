import type { ReactNode, SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function Svg({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);
const BuildingIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7.5h.01M15 7.5h.01M9 11.5h.01M15 11.5h.01M9 15.5h.01M15 15.5h.01" />
    <path d="M3 21h18" />
  </Svg>
);
export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);
const RouteIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
  </Svg>
);
const PackageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" />
    <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
  </Svg>
);
const CarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 16.5V12l1.8-4.5A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.5L19 12v4.5" />
    <path d="M3.5 12h17M5 16.5h14v2H5z" />
    <circle cx="8" cy="14.5" r=".6" />
    <circle cx="16" cy="14.5" r=".6" />
  </Svg>
);
const WarehouseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9.5 12 4l9 5.5V20H3V9.5Z" />
    <path d="M8 20v-6h8v6M8 17h8" />
  </Svg>
);
const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m21 3-9.5 18-2.5-7.5L1.5 11 21 3Z" />
    <path d="m9 13.5 12-10.5" />
  </Svg>
);
export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7z" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </Svg>
);

const SERVICE_ICONS: Record<string, (p: IconProps) => ReactNode> = {
  home: HomeIcon,
  building: BuildingIcon,
  'map-pin': MapPinIcon,
  route: RouteIcon,
  package: PackageIcon,
  car: CarIcon,
  warehouse: WarehouseIcon,
  send: SendIcon,
  truck: TruckIcon,
};

export function ServiceIcon({ name, ...rest }: IconProps & { name: string }) {
  const Icon = SERVICE_ICONS[name] ?? PackageIcon;
  return <>{Icon(rest)}</>;
}

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </Svg>
);
export const StarIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" strokeWidth={1}>
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
  </Svg>
);
export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);
export const MailIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);
export const WhatsappIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5 5 16A8.5 8.5 0 1 1 8 19l-4.5 1.5Z" />
    <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .7a4 4 0 0 1-2-2l.7-1-1-2L9 8.5Z" />
  </Svg>
);
export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.500 7.500-5 7.500-9.500V6L12 3Z" />
    <path d="m9 12 2.200 2.200L15.500 10" />
  </Svg>
);

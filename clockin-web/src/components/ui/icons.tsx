import { cn } from '@/lib/cn';

type IconProps = {
  className?: string;
};

function iconClass(className?: string) {
  return cn('h-5 w-5 shrink-0', className);
}

export function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconTime({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.75V12l3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <rect
        x="3.75"
        y="5.75"
        width="16.5"
        height="14.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3.75 10h16.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 3.75v3.5M16 3.75v3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconClients({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M4 19.5V7.75A1.75 1.75 0 0 1 5.75 6H11v13.5H5.75A1.75 1.75 0 0 1 4 19.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M11 6h7.25A1.75 1.75 0 0 1 20 7.75V19.5a1.75 1.75 0 0 1-1.75 1.75H11"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M7 9.5h2M7 12.5h2M14 9.5h3M14 12.5h3M14 15.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconProjects({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M4 8.5h16M4 12.5h16M4 16.5h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="7" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="7" cy="12.5" r="1.1" fill="currentColor" />
      <circle cx="7" cy="16.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconTasks({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6.75 5.75 8 8 5.5M4.5 12.25 5.75 13.5 8 11M4.5 17.75 5.75 19 8 16.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTickets({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M4.5 8.25A1.75 1.75 0 0 1 6.25 6.5h11.5a1.75 1.75 0 0 1 1.75 1.75v1.4a1.75 1.75 0 1 0 0 3.1v1.4a1.75 1.75 0 0 1-1.75 1.75H6.25A1.75 1.75 0 0 1 4.5 14.65v-1.4a1.75 1.75 0 1 0 0-3.1V8.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.5 2.5" />
    </svg>
  );
}

export function IconTeam({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <circle cx="9" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.75 18.5c.7-2.6 2.7-4.1 5.25-4.1s4.55 1.5 5.25 4.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.75 14.75c1.45.15 2.85.85 3.7 2.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconRates({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M12 3.75v16.5M15.25 7.25c-.7-1-1.85-1.6-3.25-1.6-2.1 0-3.5 1.2-3.5 2.85 0 1.55 1.15 2.4 3.35 2.95 2.35.6 3.65 1.55 3.65 3.35 0 1.85-1.55 3.15-3.85 3.15-1.55 0-2.85-.65-3.6-1.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconReports({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M5.5 18.5V10M10.5 18.5V6.5M15.5 18.5v-6M20.5 18.5V9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M4.5 7h15M4.5 12h15M4.5 17h15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M15 5.5 8.5 12 15 18.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M9 5.5 15.5 12 9 18.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M10 5.5H7.5A2 2 0 0 0 5.5 7.5v9A2 2 0 0 0 7.5 18.5H10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.5 12H20M17 8.5 20.5 12 17 15.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M12 3.75 19 6.5v5.25c0 4.4-2.9 7.45-7 8.75-4.1-1.3-7-4.35-7-8.75V6.5L12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBuilding({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5H12v15H5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 9h5.5A1.5 1.5 0 0 1 19 10.5V20h-7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M8 8.5h1.5M8 11.5h1.5M8 14.5h1.5M15 12.5h1.5M15 15.5h1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <circle cx="12" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 18.5c1-3 3.2-4.5 6.5-4.5s5.5 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <rect x="3.75" y="5.75" width="16.5" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m5.5 8 6.5 5 6.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconApprovals({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass(className)} aria-hidden>
      <path
        d="M7 12.5 10.2 15.5 17 8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

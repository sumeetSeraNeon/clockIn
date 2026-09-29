import { BrandMark } from '@/components/common/BrandMark';
import { cn } from '@/lib/cn';

type LoadingScreenProps = {
  message?: string;
  className?: string;
};

/** Full-viewport quiet loading state (auth bootstrap, redirects). */
export function LoadingScreen({
  message = 'Loading…',
  className,
}: LoadingScreenProps) {
  return (
    <main
      className={cn(
        'flex h-full flex-col items-center justify-center gap-3 bg-paper px-4',
        className,
      )}
    >
      <BrandMark size={40} className="animate-pulse rounded-2xl" />
      <p className="text-sm text-slate">{message}</p>
    </main>
  );
}

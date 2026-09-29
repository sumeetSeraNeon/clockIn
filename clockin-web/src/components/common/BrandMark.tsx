import Image from 'next/image';
import { cn } from '@/lib/cn';

type BrandMarkProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

/** ClockIn logo from /public/icon.png — used in shell, login, favicon. */
export function BrandMark({
  className,
  size = 44,
  priority = false,
}: BrandMarkProps) {
  return (
    <Image
      src="/icon.png"
      alt="ClockIn"
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 rounded-2xl object-cover', className)}
    />
  );
}

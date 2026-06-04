import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

/**
 * Komponen loading spinner yang reusable
 * Digunakan di: tombol submit, loading page, AuthGuard
 */
export default function Spinner({ size = 16, className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${className}`}
      aria-label="Memuat..."
    />
  );
}

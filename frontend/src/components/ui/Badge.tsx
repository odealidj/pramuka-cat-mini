interface BadgeProps {
  variant: 'super_admin' | 'admin' | 'peserta' | 'active' | 'inactive';
  label?: string;
}

const config: Record<BadgeProps['variant'], { label: string; className: string }> = {
  super_admin: {
    label: 'Super Admin',
    className: 'bg-purple-100 text-purple-800 border border-purple-200',
  },
  admin: {
    label: 'Admin',
    className: 'bg-amber-100 text-amber-800 border border-amber-200',
  },
  peserta: {
    label: 'Peserta',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  active: {
    label: 'Aktif',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  inactive: {
    label: 'Nonaktif',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
};

export default function Badge({ variant, label }: BadgeProps) {
  const { label: defaultLabel, className } = config[variant];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
    >
      {label ?? defaultLabel}
    </span>
  );
}

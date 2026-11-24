import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Ban,
  Banknote,
  Bike,
  CheckCircle2,
  Circle,
  CloudCheck,
  CloudOff,
  Coffee,
  Hourglass,
  Loader2,
  MapPin,
  Package,
  Store,
  Truck,
  UserRound,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

/**
 * Maps the icon names in `models/statuses.ts` (ported from Flutter's
 * IconData hints) onto lucide components.
 */
const ICONS: Record<string, LucideIcon> = {
  hourglass: Hourglass,
  banknote: Banknote,
  'banknote-x': Banknote,
  store: Store,
  utensils: UtensilsCrossed,
  package: Package,
  'user-pin': UserRound,
  bike: Bike,
  'map-pin': MapPin,
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  ban: Ban,
  'alert-circle': AlertCircle,
  'cloud-off': CloudOff,
  'cloud-check': CloudCheck,
  coffee: Coffee,
  loader: Loader2,
  truck: Truck,
};

interface StatusIconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const StatusIcon = ({ name, size = 18, className, strokeWidth = 2 }: StatusIconProps) => {
  const Icon = ICONS[name] ?? Circle;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
};

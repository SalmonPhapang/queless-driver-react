import { cn } from '../lib/cn';

interface LocationInfoRowProps {
  label: string;
  address: string;
  completed?: boolean;
  inactive?: boolean;
}

/** Port of widgets/order_card_widgets.dart LocationInfoRow. */
export const LocationInfoRow = ({ label, address, completed = false, inactive = false }: LocationInfoRowProps) => (
  <div className={cn('route-info', inactive && 'route-info--inactive')}>
    <span className="route-info__label">{label}</span>
    <span className={cn('route-info__address', completed && 'route-info__address--done')}>{address}</span>
  </div>
);

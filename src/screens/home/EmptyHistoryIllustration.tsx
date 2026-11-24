import { Info, RefreshCw, Sun } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './tabs.css';

/** Port of lib/widgets/empty_history_illustration.dart. */
export const EmptyHistoryIllustration = ({ onRefresh }: { onRefresh?: () => void }) => (
  <div className="history-empty">
    <div className="history-empty__art">
      <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="84" fill="var(--primary)" opacity="0.06" />
        <circle cx="100" cy="100" r="72" fill="none" stroke="var(--primary)" strokeWidth="2" opacity="0.12" />
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeDasharray="5 12"
          strokeLinecap="round"
          opacity="0.08"
        />
        <rect x="70" y="86" width="60" height="46" rx="8" fill="var(--primary)" opacity="0.15" />
        <rect x="70" y="86" width="60" height="46" rx="8" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" />
        <rect x="67" y="76" width="66" height="16" rx="4" fill="var(--primary)" opacity="0.25" />
        <rect x="67" y="76" width="66" height="16" rx="4" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.4" />
        <path
          d="M 86.8 109 L 97 115.2 L 113.2 100.7"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <circle cx="58" cy="59.5" r="3" fill="var(--primary)" opacity="0.5" />
        <circle cx="145" cy="63" r="2.5" fill="var(--primary)" opacity="0.5" />
        <circle cx="148" cy="138.5" r="3.5" fill="var(--primary)" opacity="0.5" />
        <path
          d="M 49 133.5 L 53 137.5 L 49 141.5 L 45 137.5 Z"
          fill="var(--primary)"
          opacity="0.35"
        />
      </svg>
    </div>
    <h2 className="history-empty__title">No completed orders yet</h2>
    <p className="history-empty__text">
      Your delivery history will appear here once you&apos;ve completed your first order.
    </p>
    <div className="stack-sm" style={{ width: '100%', marginTop: 24 }}>
      <div className="history-empty__tip">
        <Info size={18} />
        <span>Switch to the Available tab to find new orders.</span>
      </div>
      <div className="history-empty__tip">
        <Sun size={18} />
        <span>Keep your app open to receive order notifications.</span>
      </div>
    </div>
    <Button variant="primary" icon={<RefreshCw size={20} />} className="mt-32" style={{ width: 200 }} onClick={onRefresh}>
      REFRESH
    </Button>
    <p className="text-faint text-xs mt-8">Pull down to refresh anytime</p>
  </div>
);

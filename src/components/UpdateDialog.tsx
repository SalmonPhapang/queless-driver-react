import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { AppVersion } from '../models/appVersion';
import type { AppStoreUpdateStatus } from '../services/versionService';

interface UpdateDialogProps {
  version: AppVersion;
  status: AppStoreUpdateStatus;
  onClose: () => void;
}

/** Port of lib/widgets/update_dialog.dart. */
export const UpdateDialog = ({ version, status, onClose }: UpdateDialogProps) => {
  const forced = status === 'forced';

  const openUpdate = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
      (/Macintosh/.test(navigator.platform) && navigator.maxTouchPoints > 1);
    const fallback = isIOS
      ? 'https://apps.apple.com/app/queless-driver/id123456789'
      : 'https://play.google.com/store/apps/details?id=com.queless.driver';
    const url = version.downloadUrl ?? fallback;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      dismissible={!forced}
      onClose={onClose}
      title={forced ? 'Update Required' : 'Update Available'}
      actions={
        <>
          {!forced && (
            <Button variant="ghost" onClick={onClose}>
              Later
            </Button>
          )}
          <Button variant="green" onClick={openUpdate}>
            Update Now
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--text)', fontSize: 15 }}>
        A new version of the app is available ({version.version}).
      </p>
      {version.releaseNotes && (
        <div>
          <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>What's New:</p>
          <p>{version.releaseNotes}</p>
        </div>
      )}
      <p>
        {forced
          ? 'Please update to the latest version to continue using the app.'
          : 'We recommend updating to the latest version for the best experience.'}
      </p>
    </Modal>
  );
};

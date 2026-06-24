/**
 * Free-app Partner Sync wrapper.
 *
 * The exported name stays the same so existing imports keep working, but the
 * feature is no longer behind a premium entitlement gate.
 */

import { PartnerSync } from './PartnerSync';

interface SecurePartnerSyncProps {
  className?: string;
}

export function SecurePartnerSync({ className }: SecurePartnerSyncProps) {
  if (className) {
    return (
      <div className={className}>
        <PartnerSync />
      </div>
    );
  }

  return <PartnerSync />;
}

export default SecurePartnerSync;

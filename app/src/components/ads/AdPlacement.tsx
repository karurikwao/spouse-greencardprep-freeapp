import { useEffect, useState } from 'react';
import { fetchPublicAdSettings, type PublicAdSettings } from '@/lib/ads/settings';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdPlacementProps {
  placement: string;
  className?: string;
}

export function AdPlacement({ placement, className }: AdPlacementProps) {
  const [settings, setSettings] = useState<PublicAdSettings | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchPublicAdSettings()
      .then((result) => {
        if (isMounted) setSettings(result);
      })
      .catch(() => {
        if (isMounted) setSettings(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !settings
      || settings.status !== 'active'
      || !settings.placements?.[placement]
      || !settings.adsensePublisherId
      || !settings.adsenseSlotId
      || typeof window === 'undefined'
    ) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ad network script failures should not affect the app experience.
    }
  }, [placement, settings]);

  if (!settings || settings.status !== 'active' || !settings.placements?.[placement]) {
    return null;
  }

  if (!settings.adsensePublisherId || !settings.adsenseSlotId) {
    return null;
  }

  return (
    <div className={className} aria-label="Sponsored resource">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={settings.adsensePublisherId}
        data-ad-slot={settings.adsenseSlotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

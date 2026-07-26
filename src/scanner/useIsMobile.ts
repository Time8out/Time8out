import { useState } from 'react';

/**
 * True only for phone browsers (Android/iPhone/etc), not desktop or tablets.
 * Camera-based scanning is only offered on phones — desktops keep the
 * hardware HID scanner (keyboard-emulation) input path.
 */
export function useIsMobile(): boolean {
  const [isMobile] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPod|BlackBerry|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent);
  });
  return isMobile;
}

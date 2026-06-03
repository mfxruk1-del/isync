import { useEffect } from 'react';

// Makes the Android/browser Back button close an overlay instead of leaving the
// app. When the overlay mounts we push a history entry; pressing Back pops it and
// fires onClose. Closing via the UI removes the entry we added so history stays
// tidy.
//
// Note: only use this for overlays that are NOT opened directly from another
// overlay (no modal-to-modal transitions), to avoid history timing issues.
export function useBackToClose(onClose: () => void) {
  useEffect(() => {
    window.history.pushState({ overlay: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // If we're closing via the UI (not the Back button), our pushed entry is
      // still on top — remove it so the next Back press behaves normally.
      if (window.history.state && window.history.state.overlay) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

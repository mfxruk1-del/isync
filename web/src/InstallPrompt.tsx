import { useEffect, useState } from 'react';

// The browser fires this before showing its native install UI. We capture it so
// we can trigger install from our own button (Android / desktop Chromium).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// A slim banner offering to install the app. Renders nothing if the visitor is
// already in the installed app, or if installation isn't possible.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [hidden, setHidden] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = isIos();
  // Show only if we can actually install: Chromium gave us a prompt, or it's iOS
  // (which installs manually via the Share menu).
  if (hidden || (!deferred && !ios)) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setHidden(true);
      setDeferred(null);
    } else if (ios) {
      setShowIosHelp(true);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">📲</span>
          <span className="text-base">Install Vault for the best experience.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={install}
            className="whitespace-nowrap rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {ios && !deferred ? 'How to install' : 'Install'}
          </button>
          <button
            onClick={() => setHidden(true)}
            aria-label="Dismiss"
            className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-2"
          >
            ✕
          </button>
        </div>
      </div>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-base bg-surface p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl">📲</div>
            <h2 className="mt-2 text-lg font-semibold">Add to Home Screen</h2>
            <ol className="mt-4 space-y-2 text-left text-sm text-muted">
              <li>
                1. Tap the <strong>Share</strong> button{' '}
                <span className="text-muted">(the square with an arrow)</span> in Safari.
              </li>
              <li>
                2. Scroll down and tap <strong>“Add to Home Screen”</strong>.
              </li>
              <li>
                3. Tap <strong>Add</strong> — Vault appears like a normal app.
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-6 w-full rounded-lg border border-base py-2 text-sm text-muted hover:bg-surface-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

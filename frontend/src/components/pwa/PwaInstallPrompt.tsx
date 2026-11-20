import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { MobileSheet } from '@/components/ui/FormControls';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'oc_pwa_banner_dismissed_v1';

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    promptSubscribers.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null;
    promptSubscribers.forEach((fn) => fn());
  });
}

const isStandaloneApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
};

const isIosSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isWebkit = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIos && isWebkit;
};

export function usePwaInstall() {
  const [, setTick] = useState(0);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useEffect(() => {
    const notify = () => setTick((t) => t + 1);
    promptSubscribers.add(notify);
    return () => {
      promptSubscribers.delete(notify);
    };
  }, []);

  const installed = isStandaloneApp();
  const canPromptNative = Boolean(deferredPromptGlobal) && !installed;
  const canShowIosGuide = !canPromptNative && isIosSafari() && !installed;
  const canInstall = canPromptNative || canShowIosGuide;

  const triggerInstall = async (): Promise<boolean> => {
    if (deferredPromptGlobal) {
      await deferredPromptGlobal.prompt();
      const choice = await deferredPromptGlobal.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPromptGlobal = null;
        promptSubscribers.forEach((fn) => fn());
        return true;
      }
      return false;
    }
    if (canShowIosGuide) {
      setIosGuideOpen(true);
    }
    return false;
  };

  return {
    installed,
    canInstall,
    iosGuideOpen,
    setIosGuideOpen,
    triggerInstall,
  };
}

export const PwaInstallBanner: React.FC = () => {
  const { installed, canInstall, iosGuideOpen, setIosGuideOpen, triggerInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (installed || !canInstall || dismissed) {
    return (
      <IosInstallSheet open={iosGuideOpen} onClose={() => setIosGuideOpen(false)} />
    );
  }

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <>
      <div className="mb-3.5 flex items-center gap-3 px-3.5 py-3 rounded-[18px] bg-church-forest text-white">
        <img
          src="/pwa-192x192.png"
          alt="Open Church"
          className="w-10 h-10 rounded-[12px] object-cover shrink-0 border border-white/15"
        />
        <div className="flex-1 min-w-0">
          <p className="m-0 text-sm font-bold leading-tight">Install Open Church</p>
          <p className="m-0 text-xs text-church-mist truncate">
            Add to your home screen for fast check-in &amp; reports
          </p>
        </div>
        <button
          type="button"
          onClick={() => void triggerInstall()}
          className="oc-press h-9 px-3.5 rounded-[12px] bg-church-lime text-church-forest text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="w-7 h-7 rounded-full flex items-center justify-center text-church-mist hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <IosInstallSheet open={iosGuideOpen} onClose={() => setIosGuideOpen(false)} />
    </>
  );
};

export const IosInstallSheet: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => (
  <MobileSheet
    open={open}
    onClose={onClose}
    title="Add Open Church to Home Screen"
    subtitle="Install Open Church as a full-screen app on your iPhone or iPad"
  >
    <div className="flex flex-col gap-3 text-sm text-[#2B352E]">
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-church-soft">
        <span className="w-9 h-9 rounded-xl bg-church-lime text-church-forest flex items-center justify-center shrink-0">
          <Share className="w-4 h-4" />
        </span>
        <span>
          1. Tap the <strong>Share</strong> button at the bottom of Safari.
        </span>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-church-soft">
        <span className="w-9 h-9 rounded-xl bg-church-lime text-church-forest flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4" />
        </span>
        <span>
          2. Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
        </span>
      </div>
    </div>
  </MobileSheet>
);

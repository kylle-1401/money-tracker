import { db } from '../../db/db.ts';

const DISMISSED_KEY = 'installHintDismissed';

export interface InstallContext {
  userAgent: string;
  maxTouchPoints: number;
  /** iOS Safari sets navigator.standalone = true when opened from the home screen. */
  standalone: boolean | undefined;
  /** True when the display-mode is standalone (installed app, any platform). */
  displayStandalone: boolean;
}

/** True on iPhone/iPad, including iPadOS, which reports itself as a Mac with touch. */
export function isIos(ctx: Pick<InstallContext, 'userAgent' | 'maxTouchPoints'>): boolean {
  return (
    /iPhone|iPad|iPod/.test(ctx.userAgent) ||
    (ctx.userAgent.includes('Macintosh') && ctx.maxTouchPoints > 1)
  );
}

/**
 * iOS has no install button, so people don't know the app can live on the home
 * screen. Show how, but only on iOS, only in the browser (not once installed), and
 * not after the user dismissed it.
 */
export function shouldShowInstallHint(ctx: InstallContext, dismissed: boolean): boolean {
  if (dismissed) return false;
  if (ctx.standalone === true || ctx.displayStandalone) return false;
  return isIos(ctx);
}

/** Reads the current browser's install context. */
export function currentInstallContext(): InstallContext {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  };
}

/** Whether the user closed the install hint before. */
export async function isInstallHintDismissed(): Promise<boolean> {
  return (await db.settings.get(DISMISSED_KEY))?.value === 'true';
}

/** Remembers that the user closed the install hint. */
export async function dismissInstallHint(): Promise<void> {
  await db.settings.put({ key: DISMISSED_KEY, value: 'true' });
}

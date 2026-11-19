import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.tsx';
import { pwaStub } from '../../test/pwaRegisterStub.ts';
import InstallHint from './InstallHint.tsx';
import {
  isInstallHintDismissed,
  isIos,
  shouldShowInstallHint,
  type InstallContext,
} from './installHint.ts';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function ctx(overrides: Partial<InstallContext>): InstallContext {
  return {
    userAgent: IPHONE_SAFARI,
    maxTouchPoints: 5,
    standalone: false,
    displayStandalone: false,
    ...overrides,
  };
}

describe('install hint rules', () => {
  it('isIos_DetectsIphoneAndIpadButNotMacOrAndroid', () => {
    expect(isIos({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 0 })).toBe(false); // a real Mac
    expect(isIos({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe(false);
  });

  it('shouldShowInstallHint_IphoneInSafari_True', () => {
    expect(shouldShowInstallHint(ctx({}), false)).toBe(true);
  });

  it('shouldShowInstallHint_AlreadyInstalled_False', () => {
    expect(shouldShowInstallHint(ctx({ standalone: true }), false)).toBe(false);
    expect(shouldShowInstallHint(ctx({ displayStandalone: true }), false)).toBe(false);
  });

  it('shouldShowInstallHint_Dismissed_False', () => {
    expect(shouldShowInstallHint(ctx({}), true)).toBe(false);
  });

  it('shouldShowInstallHint_Android_False', () => {
    expect(shouldShowInstallHint(ctx({ userAgent: ANDROID_CHROME }), false)).toBe(false);
  });
});

describe('InstallHint', () => {
  it('InstallHint_IphoneSafari_ShowsStepsAndDismissIsRemembered', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InstallHint context={ctx({})} />);

    const card = await screen.findByRole('complementary', { name: 'Install the app' });
    expect(card).toHaveTextContent('Add to Home Screen');
    expect(screen.getByRole('img', { name: 'the Share button' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss install tip' }));

    expect(await isInstallHintDismissed()).toBe(true);
    unmount();
    render(<InstallHint context={ctx({})} />);
    // Give the live query a tick, then confirm it stays hidden.
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole('complementary', { name: 'Install the app' }),
    ).not.toBeInTheDocument();
  });

  it('InstallHint_Installed_RendersNothing', async () => {
    render(<InstallHint context={ctx({ standalone: true })} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole('complementary', { name: 'Install the app' }),
    ).not.toBeInTheDocument();
  });
});

describe('UpdatePrompt', () => {
  beforeEach(() => pwaStub.reset());

  function renderApp() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
  }

  it('UpdatePrompt_Nothing_RendersNothing', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Home' });
    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to work offline.')).not.toBeInTheDocument();
  });

  it('UpdatePrompt_OfflineReady_ShowsAndCloses', async () => {
    pwaStub.offlineReady = true;
    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText('Ready to work offline.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Ready to work offline.')).not.toBeInTheDocument();
  });

  it('UpdatePrompt_NewVersion_ReloadAppliesUpdate', async () => {
    pwaStub.needRefresh = true;
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Reload' }));
    expect(pwaStub.updateCalls).toEqual([true]);
  });

  it('UpdatePrompt_NewVersion_LaterKeepsCurrentVersion', async () => {
    pwaStub.needRefresh = true;
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Later' }));
    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    expect(pwaStub.updateCalls).toEqual([]);
  });
});

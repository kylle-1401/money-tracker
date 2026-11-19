import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.tsx';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell', () => {
  it('App_StartAtRoot_ShowsHomeWithHomeTabActive', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'List' })).not.toHaveAttribute('aria-current');
  });

  it('App_TapTabs_SwitchesPageAndActiveTab', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'List' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('App_ChangePage_MovesFocusToPageHeading', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'Settings' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus();
  });

  it('App_UnknownRoute_RedirectsToHome', () => {
    renderAt('/does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
  });

  it('App_NewUser_ShowsEmptyStateNotBlankPage', async () => {
    renderAt('/transactions');

    // The list reads from IndexedDB, so the empty state appears after loading.
    expect(await screen.findByRole('heading', { name: 'No transactions yet' })).toBeInTheDocument();
  });

  it('TabBar_Always_IsLabelledNavigation', () => {
    renderAt('/');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

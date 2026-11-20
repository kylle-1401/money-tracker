import { useSyncExternalStore } from 'react';
import type { BudgetCrossing } from './budget.ts';

/*
 * The budget alerts waiting to be shown. A tiny in-memory store (not React state)
 * because the alert is raised on the entry form and must still show after the form
 * closes and the app navigates back. Nothing is saved: alerts are about the save
 * that just happened.
 */

let current: readonly BudgetCrossing[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Shows these alerts (replacing any older ones). An empty list does nothing. */
export function showBudgetAlerts(crossings: readonly BudgetCrossing[]): void {
  if (crossings.length === 0) return;
  current = crossings;
  emit();
}

/** Hides the alerts. */
export function dismissBudgetAlerts(): void {
  current = [];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The alerts to show right now (re-renders when they change). */
export function useBudgetAlerts(): readonly BudgetCrossing[] {
  return useSyncExternalStore(subscribe, () => current);
}

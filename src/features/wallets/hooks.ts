import { useLiveQuery } from 'dexie-react-hooks';
import type { Wallet } from '../../db/types.ts';
import { listWallets } from './walletRepository.ts';

/**
 * Live list of every wallet (active first, then archived). Undefined while loading.
 */
export function useWallets() {
  return useLiveQuery(listWallets, []);
}

/** Builds an id → wallet lookup (archived included: old entries still need a name). */
export function toWalletMap(wallets: readonly Wallet[]): Map<string, Wallet> {
  return new Map(wallets.map((w) => [w.id, w]));
}

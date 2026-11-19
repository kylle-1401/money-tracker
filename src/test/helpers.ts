/** First item of a list, or a clear test failure if it's empty (instead of a `!` assertion). */
export function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error('Expected at least one item, got an empty list');
  return item;
}

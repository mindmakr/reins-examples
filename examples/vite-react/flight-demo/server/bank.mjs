// A simulated bank for the flight demo. It moves no money and calls nothing outside this process.
//
// Each transfer takes the next behaviour from its script (BANK_SCRIPT, comma-separated, repeating):
//   settle     accepts the transfer and confirms it settled a moment later, through `onConfirm`
//   pending    answers "pending" and sends no confirmation; the transfer settles after `settleAfterMs`,
//              and only a caller that asks `status()` learns that
//   duplicate  accepts the transfer and sends its settlement confirmation twice, as real banks sometimes do
//
// The bank behaves the same in broken and fixed mode. What changes between the modes is the payout code.

const BEHAVIOURS = new Set(['settle', 'pending', 'duplicate']);

/** Parses BANK_SCRIPT. Throws on an unknown behaviour, so a typo is not silently a plain settle. */
export function parseBankScript(text) {
  const script = String(text || 'settle')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of script) {
    if (!BEHAVIOURS.has(s)) throw new Error(`BANK_SCRIPT: unknown behaviour "${s}" (use settle, pending or duplicate)`);
  }
  return script.length ? script : ['settle'];
}

/**
 * @param {{ script?: string[], confirmAfterMs?: number, settleAfterMs?: number,
 *           onConfirm: (transferId: string, status: 'settled') => void }} options
 */
export function createBank({ script = ['settle'], confirmAfterMs = 150, settleAfterMs = 1500, onConfirm }) {
  let next = 0;
  /** @type {Map<string, { behaviour: string, sentAt: number }>} */
  const transfers = new Map();
  const later = (ms, fn) => setTimeout(fn, ms).unref?.();

  return {
    /** Sends a transfer. Answers `accepted` (a confirmation follows) or `pending` (nothing follows). */
    async send(payoutId, amountCents) {
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('amount must be a positive whole number of cents');
      const behaviour = script[next++ % script.length];
      const transferId = `tr-${payoutId}`;
      transfers.set(transferId, { behaviour, sentAt: Date.now() });
      if (behaviour === 'pending') return { transferId, status: 'pending' };
      later(confirmAfterMs, () => onConfirm(transferId, 'settled'));
      if (behaviour === 'duplicate') later(confirmAfterMs * 3, () => onConfirm(transferId, 'settled'));
      return { transferId, status: 'accepted' };
    },

    /** The transfer's status now, for a caller that polls. */
    async status(transferId) {
      const t = transfers.get(transferId);
      if (!t) return 'unknown';
      if (t.behaviour !== 'pending') return 'settled';
      return Date.now() - t.sentAt >= settleAfterMs ? 'settled' : 'pending';
    },
  };
}

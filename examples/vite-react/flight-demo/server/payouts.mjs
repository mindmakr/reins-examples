// The payout process of Payday Invoice Studio: pay an employee from the payroll pool through the bank, then
// debit the ledger. Each step is reported to flight with `step(key, name)`; the step names are the ones declared
// in reins.flight.json. Flight only records and reports. It never retries, settles or blocks anything here.
//
// PAYOUT_MODE switches between two versions of this code:
//   broken  the code waits for a bank confirmation that never comes for a pending transfer, so that payout
//           stays pending; and it debits the ledger on every confirmation, so a repeated one debits twice.
//   fixed   the code asks the bank about a pending transfer until it settles or fails, and debits the ledger
//           once per payout, ignoring a repeated confirmation.

import { randomUUID } from 'node:crypto';

export const MODES = ['broken', 'fixed'];

/**
 * @param {{ mode: 'broken' | 'fixed', bank: ReturnType<typeof import('./bank.mjs').createBank>,
 *           step: (key: string, name: string) => void, pollEveryMs?: number, pollForMs?: number }} options
 */
export function createPayouts({ mode, bank, step, pollEveryMs = 500, pollForMs = 60_000 }) {
  if (!MODES.includes(mode)) throw new Error(`PAYOUT_MODE must be broken or fixed, not "${mode}"`);
  /** @type {Map<string, { id: string, amountCents: number, transferId?: string, status: string, debits: number }>} */
  const payouts = new Map();
  const byTransfer = new Map();
  /** The ledger: one entry per debit. The pool balance is the opening balance minus their sum. */
  const ledger = [];

  function debit(p) {
    ledger.push({ payoutId: p.id, amountCents: p.amountCents, at: new Date().toISOString() });
    p.debits += 1;
    p.status = 'paid';
    step(p.id, 'ledger.debited');
  }

  /** The bank says the transfer settled: a confirmation it sent, or the answer to a poll. */
  function settled(transferId) {
    const p = byTransfer.get(transferId);
    if (!p) return;
    if (mode === 'fixed' && p.status !== 'sent' && p.status !== 'pending') return; // already handled once
    p.status = 'settled';
    step(p.id, 'bank.settled');
    debit(p); // broken: runs again for a repeated confirmation
  }

  /** Fixed mode only: ask the bank about a pending transfer until it settles or fails. */
  function follow(p) {
    const started = Date.now();
    const tick = async () => {
      if (p.status !== 'pending') return;
      const s = await bank.status(p.transferId);
      if (s === 'settled') return settled(p.transferId);
      if (s === 'failed' || s === 'unknown' || Date.now() - started > pollForMs) {
        p.status = 'failed';
        step(p.id, 'bank.failed');
        return;
      }
      setTimeout(() => void tick().catch(() => {}), pollEveryMs).unref?.();
    };
    setTimeout(() => void tick().catch(() => {}), pollEveryMs).unref?.();
  }

  return {
    mode,

    /** Starts a payout and returns once the bank has answered. */
    async create(amountCents) {
      const p = { id: `po-${randomUUID().slice(0, 13)}`, amountCents, status: 'requested', debits: 0 };
      payouts.set(p.id, p);
      step(p.id, 'requested');
      const sent = await bank.send(p.id, amountCents);
      p.transferId = sent.transferId;
      byTransfer.set(sent.transferId, p);
      p.status = 'sent';
      step(p.id, 'bank.sent');
      if (sent.status === 'pending') {
        p.status = 'pending';
        step(p.id, 'bank.pending');
        if (mode === 'fixed') follow(p);
        // broken: nothing asks the bank again, so this payout stays pending
      }
      return { id: p.id, status: p.status };
    },

    /** Called by the bank for each confirmation it sends. */
    onConfirm(transferId, status) {
      if (status === 'settled') settled(transferId);
    },

    get(id) {
      const p = payouts.get(id);
      return p && { id: p.id, amountCents: p.amountCents, status: p.status, debits: p.debits };
    },

    list() {
      return [...payouts.values()].map((p) => ({ id: p.id, amountCents: p.amountCents, status: p.status, debits: p.debits }));
    },

    ledgerTotalCents: () => ledger.reduce((sum, e) => sum + e.amountCents, 0),
  };
}

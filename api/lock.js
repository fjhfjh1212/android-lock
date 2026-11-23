import { kv } from '@vercel/kv';

const KEY = 'android-lock';
const LOCK_MS = 30 * 60 * 1000;

function emptyLock() {
  return { locked: false, lockedAt: null, expiresAt: null, by: null };
}

async function readLock() {
  const raw = await kv.get(KEY);
  if (!raw) return emptyLock();
  const lock = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!lock || !lock.locked) return emptyLock();
  if (lock.expiresAt && Date.now() > lock.expiresAt) {
    await kv.del(KEY);
    const expired = emptyLock();
    expired.expired = true;
    return expired;
  }
  return {
    locked: true,
    lockedAt: lock.lockedAt || null,
    expiresAt: lock.expiresAt || null,
    by: lock.by || 'user'
  };
}

export default async function handler(req, res) {
  try {
    const action = req.query.action;
    if (action === 'state') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
      return res.status(200).json(await readLock());
    }
    if (action === 'take') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
      const now = Date.now();
      const lock = { locked: true, lockedAt: now, expiresAt: now + LOCK_MS, by: 'user' };
      await kv.set(KEY, lock);
      return res.status(200).json(lock);
    }
    if (action === 'release') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
      await kv.del(KEY);
      return res.status(200).json(emptyLock());
    }
    return res.status(404).json({ error: 'not_found' });
  } catch (err) {
    return res.status(500).json({ error: 'lock_service_error', message: String((err && err.message) || err) });
  }
}

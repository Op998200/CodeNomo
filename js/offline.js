import { toast } from './supabase.js';

const QUEUE_KEY = 'cashivo_offline_tx_queue_v1';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export function queueIfOffline(action, payload) {
  if (navigator.onLine) return false;
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ id: crypto.randomUUID(), action, payload, at: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  toast('Saved offline. Will sync when online.', 'info');
  return true;
}

export function trySync(processor) {
  const sync = async () => {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (!queue.length) return;
    for (const item of queue) {
      try {
        // processor returns true on success
        const ok = await processor(item);
        if (ok) removeFromQueue(item.id);
      } catch (_e) {}
    }
  };
  window.addEventListener('online', sync);
  // Try once after small delay
  setTimeout(sync, 1500);
}

function removeFromQueue(id) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  const next = queue.filter(q => q.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
}
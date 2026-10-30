/* stable-feed.js v6 — keep every message of the Claude Desktop transcript mounted.
 *
 * The transcript list (rocksteady virtualizer) mounts the rows that fall in
 * the scroller's visible height plus a margin, and every row once the rest of
 * the content fits in twice that height. This script makes the transcript
 * scroller report a height far larger than its content, so the list mounts
 * every row itself: React keeps rendering them, so nothing is detached,
 * duplicated or reordered, and expandable blocks, buttons and tasks stay live.
 *
 * `scrollHeight` is raised by the same amount, so `scrollHeight - clientHeight`
 * (the maximum scroll, the "at bottom" test) stays exactly the real one.
 * Only the transcript scrollers are touched, as own properties of those
 * elements; nothing in the prototypes changes.
 *
 * The list stores the visible height only when the scroller's size changes
 * (its ResizeObserver) and restores a saved real height when a session is
 * reopened; a plain scroll updates the total height alone. A mismatch makes
 * "follow the end" start the window near the bottom. So a watchdog checks
 * every list once a second and, when rows are missing (judged from the row
 * indexes and the messages' aria-posinset / aria-setsize), changes the
 * scroller's padding by one pixel for one rendered frame: the ResizeObserver
 * fires and the list re-reads the (fake) height.
 *
 * Install: DevTools (Ctrl+Alt+I) > Console, paste, Enter. Running it again
 * replaces the previous version in place.
 * Ctrl+L, or __stableFeed.focusLast(), focuses the last message; the
 * focus never moves by itself (__stableFeed.focusKey changes or disables the
 * shortcut).
 *
 * Status: __stableFeed.status()   Re-measures so far: __stableFeed.nudges
 * Off: __stableFeed.stop()
 * Do not run together with the older removeChild-patching snippet (unvirt).
 */
(() => {
  const previous = window.__stableFeed;
  if (previous) (previous.detach ?? previous.stop)?.call(previous, { keepPatched: true });

  const SIZER = '[data-rocksteady-sizer]';
  const CH = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  const SH = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
  const MIN_FAKE = 1_000_000;
  const S = (window.__stableFeed = { version: 6, patched: new Set(), nudges: 0, busy: new Set() });

  const scrollerOf = sizer => {
    for (let el = sizer.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return null;
  };

  // Hold a one-pixel padding change across a rendered frame, so the
  // ResizeObserver sees it (rAF callbacks run before that frame's layout).
  const nudge = el => {
    if (S.busy.has(el)) return;
    S.busy.add(el);
    S.nudges++;
    const pad = el.style.paddingBottom;
    el.style.paddingBottom = '1px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.paddingBottom = pad;
      S.busy.delete(el);
    }));
  };

  const patch = el => {
    if (S.patched.has(el)) return;
    S.patched.add(el);
    if (Object.getOwnPropertyDescriptor(el, 'clientHeight')) return; // kept from a previous version
    const realCH = () => CH.get.call(el);
    const realSH = () => SH.get.call(el);
    const fake = () => Math.max(MIN_FAKE, 4 * realSH());
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => fake() });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => realSH() + fake() - realCH() });
    nudge(el);
  };

  const unpatch = el => {
    delete el.clientHeight;
    delete el.scrollHeight;
    S.patched.delete(el);
    if (el.isConnected) nudge(el);
  };

  const inspect = sizer => {
    // Rows left out are stood in for by spacers, but a spacer also carries the
    // list's own padding, so its height says little. Instead: the rows must
    // start at 0 with no gap in the indexes, and the last message mounted must
    // be the last one (each message has aria-posinset / aria-setsize).
    const idx = [...sizer.querySelectorAll('[data-rs-index]')].map(w => +w.getAttribute('data-rs-index'));
    const contiguous = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
    const msgs = sizer.querySelectorAll('[aria-setsize]');
    const lastMsg = msgs[msgs.length - 1];
    const pos = lastMsg ? +lastMsg.getAttribute('aria-posinset') : null;
    const size = lastMsg ? +lastMsg.getAttribute('aria-setsize') : null;
    return {
      complete: idx.length === 0 || (idx[0] === 0 && contiguous && pos === size),
      rows: idx.length,
      first: idx.length ? Math.min(...idx) : null,
      last: idx.length ? Math.max(...idx) : null,
      messages: lastMsg ? pos + '/' + size : null,
    };
  };

  const keep = sizer => {
    const el = scrollerOf(sizer);
    if (!el) return null;
    patch(el);
    const state = inspect(sizer);
    if (!state.complete) nudge(el);
    return state;
  };

  // Watchdog: keeps every list patched and whole.
  const tick = () => {
    for (const sizer of document.querySelectorAll(SIZER)) keep(sizer);
    for (const el of S.patched) if (!el.isConnected) S.patched.delete(el);
  };
  S.timer = setInterval(tick, 1000);

  // Focus the last message, on demand only. If the end of the list is not
  // mounted yet, re-measure and wait for it (one second at most), so the
  // focus lands on the true last message.
  const lastArticle = sizer => {
    const articles = sizer.querySelectorAll('[role="article"]');
    return articles[articles.length - 1] ?? null;
  };
  let waiting = null;
  S.focusLast = () => {
    const sizer = document.querySelector(SIZER);
    if (!sizer) return false;
    clearInterval(waiting);
    const started = Date.now();
    const attempt = () => {
      const state = keep(sizer);
      if (state && !state.complete && Date.now() - started < 1000) return false;
      clearInterval(waiting);
      const last = lastArticle(sizer);
      if (!last) return false;
      if (!last.hasAttribute('tabindex')) last.setAttribute('tabindex', '-1');
      last.focus();
      return true;
    };
    if (attempt()) return true;
    waiting = setInterval(attempt, 100);
    return false;
  };

  // Keyboard shortcut for focusLast, wherever the focus is. Default Ctrl+L
  // (physical key, so the same on AZERTY and QWERTY). Change it with
  // __stableFeed.focusKey = { code: 'KeyL', ctrl: true, alt: false,
  // shift: false }, or set it to null to turn the shortcut off.
  S.focusKey = { code: 'KeyL', ctrl: true, alt: false, shift: false };
  const onKey = e => {
    const k = S.focusKey;
    if (!k || e.code !== k.code || e.repeat) return;
    if (e.altKey !== !!k.alt || e.shiftKey !== !!k.shift || e.ctrlKey !== !!k.ctrl || e.metaKey) return;
    if (!document.querySelector(SIZER)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    S.focusLast();
  };
  window.addEventListener('keydown', onKey, true);

  S.status = () => {
    const out = [...document.querySelectorAll(SIZER)].map(sizer => {
      const el = scrollerOf(sizer);
      return { ...inspect(sizer), patched: !!el && S.patched.has(el) };
    });
    console.log('[stable-feed] v6 ' + JSON.stringify(out) + ' nudges=' + S.nudges);
    return out;
  };

  S.detach = ({ keepPatched = false } = {}) => {
    clearInterval(S.timer);
    clearInterval(waiting);
    window.removeEventListener('keydown', onKey, true);
    if (!keepPatched) for (const el of [...S.patched]) unpatch(el);
    delete window.__stableFeed;
  };
  S.stop = () => { S.detach(); console.log('[stable-feed] off'); };

  tick();
  setTimeout(S.status, 800);
})();

/* stable-feed.js v5 — keep every message of the Claude Desktop transcript mounted.
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
 * every list once a second and, when rows are missing, changes the
 * scroller's padding by one pixel for one rendered frame: the ResizeObserver
 * fires and the list re-reads the (fake) height.
 *
 * Install: DevTools (Ctrl+Alt+I) > Console, paste, Enter. Running it again
 * replaces the previous version in place.
 * Since v5, a session switch focuses the last message once the list is whole
 * (__stableFeed.focusLastOnSwitch = false turns it off; __stableFeed.focusLast()
 * does it on demand).
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
  const S = (window.__stableFeed = { version: 5, patched: new Set(), nudges: 0, busy: new Set() });

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
    // Rows left out are stood in for by spacers. A spacer also carries the
    // list's fixed padding (48px in the Code tab), so only a taller one, or a
    // gap in the indexes, means rows are missing.
    const spacers = [...sizer.querySelectorAll('[data-testid="transcript-spacer"]')]
      .map(s => Math.round(parseFloat(s.style.height) || 0));
    const idx = [...sizer.querySelectorAll('[data-rs-index]')].map(w => +w.getAttribute('data-rs-index'));
    const contiguous = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
    return {
      complete: idx.length === 0 || (idx[0] === 0 && contiguous && spacers.every(h => h <= 64)),
      rows: idx.length,
      first: idx.length ? Math.min(...idx) : null,
      last: idx.length ? Math.max(...idx) : null,
      spacers,
    };
  };

  // On a session switch (the path names the session), once its list is whole,
  // focus the last message so the screen reader starts there instead of at the
  // top of the page. Never taken from someone typing: only when the focus is
  // nowhere, or on an empty prompt.
  S.focusLastOnSwitch = true;
  let lastPath = location.pathname;
  let pending = null;
  const canTakeFocus = () => {
    const a = document.activeElement;
    if (!a || a === document.body) return true;
    return a.getAttribute('role') === 'textbox' && a.textContent.trim() === '';
  };
  const focusLast = sizer => {
    const articles = sizer.querySelectorAll('[role="article"]');
    const last = articles[articles.length - 1];
    if (!last) return false;
    if (!last.hasAttribute('tabindex')) last.setAttribute('tabindex', '-1');
    last.focus();
    return true;
  };
  S.focusLast = () => {
    const sizer = document.querySelector(SIZER);
    return !!sizer && focusLast(sizer);
  };

  const tick = () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      pending = S.focusLastOnSwitch ? { path: lastPath, at: Date.now() } : null;
    }
    for (const sizer of document.querySelectorAll(SIZER)) {
      const el = scrollerOf(sizer);
      if (!el) continue;
      patch(el);
      const state = inspect(sizer);
      if (!state.complete) nudge(el);
      // Wait for the whole list, three seconds at most.
      if (pending && state.rows > 0 && (state.complete || Date.now() - pending.at > 3000)) {
        if (canTakeFocus()) focusLast(sizer);
        pending = null;
      }
    }
    if (pending && Date.now() - pending.at > 10000) pending = null;
    for (const el of S.patched) if (!el.isConnected) S.patched.delete(el);
  };
  S.timer = setInterval(tick, 1000);

  S.status = () => {
    const out = [...document.querySelectorAll(SIZER)].map(sizer => {
      const el = scrollerOf(sizer);
      return { ...inspect(sizer), patched: !!el && S.patched.has(el) };
    });
    console.log('[stable-feed] v5 ' + JSON.stringify(out) + ' nudges=' + S.nudges);
    return out;
  };

  S.detach = ({ keepPatched = false } = {}) => {
    clearInterval(S.timer);
    if (!keepPatched) for (const el of [...S.patched]) unpatch(el);
    delete window.__stableFeed;
  };
  S.stop = () => { S.detach(); console.log('[stable-feed] off'); };

  tick();
  setTimeout(S.status, 800);
})();

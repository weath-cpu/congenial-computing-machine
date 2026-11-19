(async () => {
  if (!window.RELAY_DOMAIN) return;
  let urls;
  try {
    const res = await fetch(`${window.RELAY_DOMAIN}israel-links.js`);
    if (!res.ok) return;
    const text = await res.text();
    urls = text.split("\n").map(l => l.trim()).filter(l => l.includes(".") && l.includes("/") && l.includes(":"));
    if (!urls.length) return;
  } catch {
    return;
  }

  // --- exposed actual-URL tracking -------------------------------------
  // window.RELAY_ACTUAL_URL    : full URL if we can read it same-origin
  // window.RELAY_ACTUAL_ORIGIN : origin string (protocol + host) we trust
  // window.RELAY_ACTUAL_HOST   : hostname we trust for popup gating
  window.RELAY_ACTUAL_URL = null;
  window.RELAY_ACTUAL_ORIGIN = null;
  window.RELAY_ACTUAL_HOST = null;

  const recordOrigin = (origin) => {
    if (!origin || !/^https?:/.test(origin)) return;
    try {
      const u = new URL(origin);
      window.RELAY_ACTUAL_ORIGIN = u.origin;
      window.RELAY_ACTUAL_HOST = u.hostname.toLowerCase();
    } catch {}
  };
  const recordUrl = (href) => {
    if (!href || href === "about:blank") return;
    try {
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      window.RELAY_ACTUAL_URL = u.href;
      window.RELAY_ACTUAL_ORIGIN = u.origin;
      window.RELAY_ACTUAL_HOST = u.hostname.toLowerCase();
    } catch {}
  };

  // Relay page posts to us from its final (post-TinyURL) origin.
  // We capture that origin as the authoritative host.
  addEventListener("message", (e) => {
    recordOrigin(e.origin);
  }, true);

  const addSf = u => u + (u.includes("?") ? "&" : "?") + "sf";

  const test = (url, ctrl) => new Promise((resolve, reject) => {
    const f = document.createElement("iframe");
    f.style.cssText = "display:none;z-index:2147483647;border:none;height:100vh;width:100vw;left:0;top:0;position:fixed;";
    document.body.appendChild(f);
    let timer, checkTimer, done = false;

    const cleanup = () => {
      window.removeEventListener("message", onMsg);
      f.removeEventListener("load", onLoad);
      clearTimeout(timer);
      clearTimeout(checkTimer);
    };
    const fail = () => {
      if (done) return;
      done = true;
      cleanup();
      f.remove();
      reject();
    };

    const verify = () => {
      try {
        const href = f.contentWindow.location.href;
        const host = new URL(url).hostname;
        if (!href || href === "about:blank" || href.includes("-extension:") || new URL(href).hostname !== host) return false;
        // If we get here, the frame is same-origin and we can read the real
        // final URL (after any redirect). Record it for the parent.
        recordUrl(href);
      } catch {
        // Cross-origin: cannot read href. Origin is learned via onMsg.
      }
      return true;
    };

    const onMsg = e => {
      if (e.source !== f.contentWindow || done) return;
      // Capture the posting frame's real origin (post-TinyURL destination).
      recordOrigin(e.origin);
      if (!verify()) return fail();
      try {
        e.source.postMessage(e.data, "*");
      } catch {}
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        if (!verify()) return fail();
        done = true;
        cleanup();
        resolve(f);
      }, 1e3);
    };

    const onLoad = () => {
      if (!verify()) return fail();
      // Also try to read the URL on load, in case the redirect landed
      // same-origin (rare but possible).
      try { recordUrl(f.contentWindow.location.href); } catch {}
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        if (!verify()) fail();
      }, 1e3);
    };

    timer = setTimeout(fail, 6e3);
    window.addEventListener("message", onMsg);
    f.addEventListener("load", onLoad);
    ctrl.signal.addEventListener("abort", () => {
      done = true;
      cleanup();
      f.remove();
    });
    f.src = addSf(url);
  });

  const ctrls = urls.map(() => new AbortController);
  try {
    const {f: win, i: winIdx} = await Promise.any(urls.map((u, i) => test(u, ctrls[i]).then(f => ({f: f, i: i}))));
    ctrls.forEach((c, i) => {
      if (i !== winIdx) c.abort();
    });
    Array.from(document.body.children).forEach(c => {
      if (c !== win) c.remove();
    });
    win.style.display = "block";

    // Final attempt to capture the actual URL from the winning frame.
    // Cross-origin will throw; the message/origin path already covered it.
    try {
      const href = win.contentWindow.location.href;
      if (href && href !== "about:blank") recordUrl(href);
    } catch {}
  } catch {}
})();

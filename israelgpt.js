
(async () => {
    if (!window.RELAY_DOMAIN) return;

    let urls;

    /*
     * Fetch the plain-text URL list.
     */
    try {
        const res = await fetch(
            `${window.RELAY_DOMAIN}israel-links.js`
        );

        if (!res.ok) return;

        const text = await res.text();

        urls = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;

                try {
                    const url = new URL(line);

                    return (
                        url.protocol === "https:" ||
                        url.protocol === "http:"
                    );
                } catch {
                    return false;
                }
            });

        if (!urls.length) return;

        // Notify once the URL list has been fetched.
        alert(`Successfully fetched ${urls.length} links!`);

    } catch (error) {
        console.error("Failed to fetch links:", error);
        return;
    }

    const addSf = u =>
        u + (u.includes("?") ? "&" : "?") + "sf";

    const test = (url, ctrl) => new Promise((resolve, reject) => {
        const f = document.createElement("iframe");

        f.style.cssText =
            "display:none;z-index:2147483647;" +
            "border:none;height:100vh;width:100vw;" +
            "left:0;top:0;position:fixed;";

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

                if (
                    !href ||
                    href === "about:blank" ||
                    href.includes("-extension:") ||
                    new URL(href).hostname !== host
                ) {
                    return false;
                }

                return true;
            } catch {
                return true;
            }
        };

        const onMsg = e => {
            if (e.source !== f.contentWindow || done) return;

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
            }, 1000);
        };

        const onLoad = () => {
            if (!verify()) return fail();

            clearTimeout(checkTimer);

            checkTimer = setTimeout(() => {
                if (!verify()) fail();
            }, 1000);
        };

        timer = setTimeout(fail, 6000);

        window.addEventListener("message", onMsg);
        f.addEventListener("load", onLoad);

        ctrl.signal.addEventListener("abort", () => {
            done = true;
            cleanup();
            f.remove();
        });

        f.src = addSf(url);
    });

    const ctrls = urls.map(() => new AbortController());

    try {
        const {
            f: win,
            i: winIdx
        } = await Promise.any(
            urls.map((u, i) =>
                test(u, ctrls[i]).then(f => ({
                    f,
                    i
                }))
            )
        );

        ctrls.forEach((c, i) => {
            if (i !== winIdx) c.abort();
        });

        Array.from(document.body.children).forEach(c => {
            if (c !== win) c.remove();
        });

        win.style.display = "block";

    } catch {
        console.warn("No links successfully loaded.");
    }
})();

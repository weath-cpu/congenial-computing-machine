
(async () => {
    if (!window.RELAY_DOMAIN) return;

    let urls;

    /*
     * FETCH URL LIST
     */
    try {
        const res = await fetch(
            `${window.RELAY_DOMAIN}israel-links.js`
        );

        if (!res.ok) throw new Error("Fetch failed");

        const text = await res.text();

        urls = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => {
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

        if (!urls.length) {
            alert("No valid links were found.");
            return;
        }

        alert(`Successfully fetched ${urls.length} links!`);

    } catch (error) {
        console.error(error);
        alert("Failed to fetch the link list.");
        return;
    }

    /*
     * SELECTION MENU
     */
    document.body.textContent = "";
    document.body.style.cssText = `
        margin: 0;
        background: #000;
        color: #fff;
        font-family: sans-serif;
        min-height: 100vh;
        padding: 30px;
        box-sizing: border-box;
    `;

    const container = document.createElement("div");

    container.style.cssText = `
        max-width: 650px;
        margin: 50px auto;
    `;

    const heading = document.createElement("h2");
    heading.textContent = "Choose a link";

    const description = document.createElement("p");
    description.textContent =
        `${urls.length} links available. Select one to continue.`;

    const list = document.createElement("div");

    list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;

    container.append(heading, description, list);
    document.body.appendChild(container);

    /*
     * LOAD SELECTED LINK
     */
    const addSf = url =>
        url + (url.includes("?") ? "&" : "?") + "sf";

    const test = (url, ctrl) => new Promise((resolve, reject) => {
        const f = document.createElement("iframe");

        f.style.cssText = `
            display: none;
            border: none;
            height: 100vh;
            width: 100vw;
            position: fixed;
            left: 0;
            top: 0;
        `;

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
            reject(new Error("Link failed"));
        };

        const verify = () => {
            try {
                const href = f.contentWindow.location.href;
                const host = new URL(url).hostname;

                if (
                    !href ||
                    href === "about:blank" ||
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

    /*
     * CREATE LINK BUTTONS
     */
    urls.forEach((url, index) => {
        const button = document.createElement("button");

        button.textContent = url;

        button.style.cssText = `
            display: block;
            width: 100%;
            padding: 14px;
            background: #171717;
            color: white;
            border: 1px solid #333;
            border-radius: 8px;
            text-align: left;
            cursor: pointer;
            overflow-wrap: anywhere;
            font-size: 14px;
        `;

        button.addEventListener("mouseenter", () => {
            button.style.background = "#292929";
        });

        button.addEventListener("mouseleave", () => {
            button.style.background = "#171717";
        });

        button.addEventListener("click", async () => {
            if (button.disabled) return;

            button.disabled = true;
            button.textContent = "Loading...";

            const controller = new AbortController();

            try {
                const frame = await test(
                    url,
                    controller
                );

                document.body.replaceChildren(frame);
                frame.style.display = "block";

            } catch {
                button.disabled = false;
                button.textContent = url;

                alert("Unable to load this link. Try another.");
            }
        });

        list.appendChild(button);
    });

})();

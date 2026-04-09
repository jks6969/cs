/**
 * Standalone PDPA Cookie Consent Banner
 * Works entirely client-side — no external backend required.
 *
 * Usage:
 *   <script src="cookie-consent.js"></script>
 *   <script>
 *     CookieConsent.init({ /* optional overrides * / });
 *   </script>
 */
(function () {
    "use strict";

    /* ================================================================
       DEFAULT CONFIGURATION
       ================================================================ */
    const DEFAULTS = {
        cookie: {
            name: "cc_cookie",
            domain: "",
            path: "/",
            expiresAfterDays: 182,
            sameSite: "Lax",
        },
        /* UI language packs */
        languages: {
            th: {
                consentModal: {
                    title: "เว็บไซต์นี้ใช้คุกกี้",
                    description:
                        "เราใช้คุกกี้เพื่อพัฒนาประสิทธิภาพ และประสบการณ์ที่ดีในการใช้เว็บไซต์ของคุณ คุณสามารถเลือกยินยอม/ไม่ยินยอมสำหรับแต่ละหมวดหมู่ได้ทุกเมื่อที่คุณต้องการ",
                    acceptAllBtn: "ยอมรับทั้งหมด",
                    acceptNecessaryBtn: "ยอมรับเฉพาะที่จำเป็น",
                    showPreferencesBtn: "ตั้งค่าคุกกี้",
                },
                preferencesModal: {
                    title: "ตั้งค่าคุกกี้",
                    savePreferencesBtn: "บันทึกตามที่ตั้งค่า",
                    acceptAllBtn: "ยอมรับทั้งหมด",
                    acceptNecessaryBtn: "ยอมรับเฉพาะที่จำเป็น",
                    closeIconLabel: "ปิด",
                },
            },
            en: {
                consentModal: {
                    title: "This website uses cookies",
                    description:
                        "We use cookies to improve performance and your browsing experience. You can choose to accept or reject each category at any time.",
                    acceptAllBtn: "Accept all",
                    acceptNecessaryBtn: "Reject non-essential",
                    showPreferencesBtn: "Cookie settings",
                },
                preferencesModal: {
                    title: "Cookie settings",
                    savePreferencesBtn: "Save preferences",
                    acceptAllBtn: "Accept all",
                    acceptNecessaryBtn: "Accept necessary only",
                    closeIconLabel: "Close",
                },
            },
        },
        /* Cookie categories */
        categories: {
            necessary: {
                label: { th: "คุกกี้ที่จำเป็น", en: "Strictly necessary" },
                description: {
                    th: "คุกกี้เหล่านี้จำเป็นสำหรับการทำงานของเว็บไซต์ ไม่สามารถปิดได้",
                    en: "These cookies are essential for the website to function and cannot be turned off.",
                },
                readOnly: true,
            },
            analytics: {
                label: { th: "คุกกี้เพื่อการวิเคราะห์", en: "Analytics" },
                description: {
                    th: "คุกกี้เหล่านี้ช่วยให้เราเข้าใจว่าผู้เข้าชมโต้ตอบกับเว็บไซต์อย่างไร",
                    en: "These cookies help us understand how visitors interact with the website.",
                },
                readOnly: false,
            },
            marketing: {
                label: { th: "คุกกี้เพื่อการตลาด", en: "Marketing" },
                description: {
                    th: "คุกกี้เหล่านี้ใช้เพื่อแสดงโฆษณาที่เกี่ยวข้องกับคุณ",
                    en: "These cookies are used to show you relevant advertisements.",
                },
                readOnly: false,
            },
        },
        /* Layout */
        guiOptions: {
            consentModal: {
                layout: "box",          // box | bar
                position: "bottom-left", // bottom-left | bottom-right | bottom-center
            },
        },
        /* Auto-detect language from <html lang="..."> */
        autoDetectLanguage: true,
        defaultLanguage: "th",

        /* Callbacks */
        onFirstConsent: null,   // function({ cookie })
        onConsent: null,        // function({ cookie })
        onChange: null,          // function({ cookie, changedCategories })
    };

    /* ================================================================
       INTERNAL STATE
       ================================================================ */
    let _config = {};
    let _lang = "th";
    let _consentModal = null;
    let _prefsModal = null;
    let _overlay = null;
    let _toggle = null;

    /* ================================================================
       HELPERS
       ================================================================ */
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);

    function deepMerge(target, source) {
        const out = Object.assign({}, target);
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                out[key] = deepMerge(out[key] || {}, source[key]);
            } else {
                out[key] = source[key];
            }
        }
        return out;
    }

    function uuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    /* ── Cookie read / write ── */
    function readCookie() {
        const name = _config.cookie.name + "=";
        const parts = document.cookie.split(";");
        for (let p of parts) {
            p = p.trim();
            if (p.indexOf(name) === 0) {
                try {
                    return JSON.parse(decodeURIComponent(p.substring(name.length)));
                } catch { return null; }
            }
        }
        return null;
    }

    function writeCookie(value) {
        const c = _config.cookie;
        const d = new Date();
        d.setTime(d.getTime() + c.expiresAfterDays * 86400000);
        let str = c.name + "=" + encodeURIComponent(JSON.stringify(value));
        str += "; expires=" + d.toUTCString();
        str += "; path=" + c.path;
        str += "; SameSite=" + c.sameSite;
        if (c.domain) str += "; domain=" + c.domain;
        document.cookie = str;
    }

    function eraseCookie(name) {
        const paths = ["/", window.location.pathname];
        const domains = ["", window.location.hostname, "." + window.location.hostname];
        for (const p of paths) {
            for (const d of domains) {
                let str = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=" + p;
                if (d) str += "; domain=" + d;
                document.cookie = str;
            }
        }
    }

    /* ── Language ── */
    function t(path) {
        const lang = _config.languages[_lang] || _config.languages["en"] || {};
        return path.split(".").reduce((o, k) => (o ? o[k] : ""), lang) || "";
    }

    function catText(cat, field) {
        const obj = _config.categories[cat]?.[field];
        if (!obj) return "";
        if (typeof obj === "string") return obj;
        return obj[_lang] || obj["en"] || Object.values(obj)[0] || "";
    }

    /* ================================================================
       STYLES  (injected once)
       ================================================================ */
    function injectStyles() {
        if ($("#cc-styles")) return;
        const style = document.createElement("style");
        style.id = "cc-styles";
        style.textContent = `
/* ── Variables ── */
:root {
    --cc-bg: #fff;
    --cc-text: #2c2f31;
    --cc-text-secondary: #5e6266;
    --cc-border: #e2e2e2;
    --cc-primary: #30363c;
    --cc-primary-hover: #1a1e22;
    --cc-primary-text: #fff;
    --cc-secondary: #eaeff2;
    --cc-secondary-hover: #d4dae0;
    --cc-secondary-text: #2c2f31;
    --cc-toggle-on: #30363c;
    --cc-toggle-off: #ccc;
    --cc-toggle-knob: #fff;
    --cc-overlay: rgba(0,0,0,.55);
    --cc-radius: .5rem;
    --cc-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --cc-z: 2147483647;
}

/* ── Overlay ── */
#cc-overlay {
    display: none;
    position: fixed; inset: 0;
    background: var(--cc-overlay);
    z-index: calc(var(--cc-z) - 1);
}
#cc-overlay.cc-show { display: block; }

/* ── Consent modal ── */
#cc-consent {
    display: none;
    position: fixed;
    z-index: var(--cc-z);
    font-family: var(--cc-font);
    color: var(--cc-text);
    max-width: 420px;
    width: calc(100% - 2rem);
    background: var(--cc-bg);
    border-radius: var(--cc-radius);
    box-shadow: 0 4px 24px rgba(0,0,0,.15);
    padding: 1.5rem;
    line-height: 1.5;
    font-size: .93rem;
    animation: ccSlideUp .3s ease;
}
#cc-consent.cc-show { display: block; }
#cc-consent.cc-bottom-left   { bottom: 1rem; left: 1rem; }
#cc-consent.cc-bottom-right  { bottom: 1rem; right: 1rem; }
#cc-consent.cc-bottom-center { bottom: 1rem; left: 50%; transform: translateX(-50%); }

#cc-consent h2 {
    margin: 0 0 .65rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--cc-text);
}
#cc-consent p {
    margin: 0 0 1.1rem;
    color: var(--cc-text-secondary);
    font-size: .88rem;
}
.cc-btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
}
.cc-btn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: .6rem 1.1rem;
    border-radius: .35rem;
    font-size: .88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background .2s, transform .15s;
    flex: 1 1 0;
    text-align: center;
    min-width: 0;
    white-space: nowrap;
}
.cc-btn:hover { transform: translateY(-1px); }
.cc-btn-primary   { background: var(--cc-primary); color: var(--cc-primary-text); }
.cc-btn-primary:hover { background: var(--cc-primary-hover); }
.cc-btn-secondary { background: var(--cc-secondary); color: var(--cc-secondary-text); }
.cc-btn-secondary:hover { background: var(--cc-secondary-hover); }
.cc-btn-link {
    background: transparent;
    color: var(--cc-primary);
    text-decoration: underline;
    font-weight: 500;
    flex: 0 0 auto;
    padding: .6rem .5rem;
}

/* ── Preferences modal ── */
#cc-prefs {
    display: none;
    position: fixed;
    z-index: var(--cc-z);
    font-family: var(--cc-font);
    color: var(--cc-text);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, calc(100% - 2rem));
    max-height: calc(100vh - 3rem);
    overflow-y: auto;
    background: var(--cc-bg);
    border-radius: var(--cc-radius);
    box-shadow: 0 8px 40px rgba(0,0,0,.2);
    padding: 1.75rem;
    line-height: 1.5;
    font-size: .93rem;
    animation: ccFadeIn .25s ease;
}
#cc-prefs.cc-show { display: block; }
#cc-prefs .cc-prefs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
}
#cc-prefs .cc-prefs-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
#cc-prefs .cc-prefs-close {
    all: unset;
    cursor: pointer;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--cc-text-secondary);
    padding: .25rem;
}
#cc-prefs .cc-prefs-close:hover { color: var(--cc-text); }

/* ── Category row ── */
.cc-category {
    border-top: 1px solid var(--cc-border);
    padding: 1rem 0;
}
.cc-category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.cc-category-header strong { font-size: .95rem; }
.cc-category-desc {
    margin-top: .35rem;
    font-size: .83rem;
    color: var(--cc-text-secondary);
}

/* ── Toggle switch ── */
.cc-toggle {
    position: relative;
    width: 44px; height: 24px;
    flex-shrink: 0;
}
.cc-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.cc-toggle-slider {
    position: absolute; inset: 0;
    background: var(--cc-toggle-off);
    border-radius: 24px;
    cursor: pointer;
    transition: background .25s;
}
.cc-toggle-slider::before {
    content: "";
    position: absolute;
    width: 18px; height: 18px;
    left: 3px; top: 3px;
    background: var(--cc-toggle-knob);
    border-radius: 50%;
    transition: transform .25s;
}
.cc-toggle input:checked + .cc-toggle-slider { background: var(--cc-toggle-on); }
.cc-toggle input:checked + .cc-toggle-slider::before { transform: translateX(20px); }
.cc-toggle input:disabled + .cc-toggle-slider { opacity: .6; cursor: default; }

/* ── Floating toggle button ── */
#cc-fab {
    display: none;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: 1rem; right: 1rem;
    width: 52px; height: 52px;
    background: transparent;
    border-radius: 50%;
    box-shadow: none;
    cursor: pointer;
    z-index: calc(var(--cc-z) - 2);
    font-size: 2.8rem;
    transition: transform .2s;
    user-select: none;
}
#cc-fab:hover { transform: scale(1.1); }
#cc-fab.cc-show { display: flex; }

/* ── Animations ── */
@keyframes ccSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ccFadeIn  { from { opacity: 0; } to { opacity: 1; } }

/* ── Mobile ── */
@media (max-width: 480px) {
    #cc-consent { max-width: none; width: calc(100% - 1rem); left: .5rem !important; right: .5rem !important; bottom: .5rem !important; transform: none !important; }
    .cc-btn-group { flex-direction: column; }
    .cc-btn { flex: none; }
}
`;
        document.head.appendChild(style);
    }

    /* ================================================================
       BUILD UI
       ================================================================ */
    function buildConsentModal() {
        const pos = _config.guiOptions.consentModal.position.replace(/-/g, " ").split(" ");
        const posClass = "cc-" + _config.guiOptions.consentModal.position;

        const modal = document.createElement("div");
        modal.id = "cc-consent";
        modal.className = posClass;

        modal.innerHTML = `
            <h2>${t("consentModal.title")}</h2>
            <p>${t("consentModal.description")}</p>
            <div class="cc-btn-group">
                <button class="cc-btn cc-btn-primary" data-cc="accept-all">${t("consentModal.acceptAllBtn")}</button>
                <button class="cc-btn cc-btn-secondary" data-cc="accept-necessary">${t("consentModal.acceptNecessaryBtn")}</button>
            </div>
            <div class="cc-btn-group" style="justify-content:center;margin-top:.35rem;">
                <button class="cc-btn cc-btn-link" data-cc="show-prefs">${t("consentModal.showPreferencesBtn")}</button>
            </div>
        `;
        return modal;
    }

    function buildPrefsModal() {
        const modal = document.createElement("div");
        modal.id = "cc-prefs";

        let catHTML = "";
        for (const [key, cat] of Object.entries(_config.categories)) {
            const checked = cat.readOnly ? "checked disabled" : "";
            const checkedAttr = cat.readOnly ? "checked" : "";
            catHTML += `
            <div class="cc-category">
                <div class="cc-category-header">
                    <strong>${catText(key, "label")}</strong>
                    <label class="cc-toggle">
                        <input type="checkbox" data-cat="${key}" ${checkedAttr} ${checked}>
                        <span class="cc-toggle-slider"></span>
                    </label>
                </div>
                <div class="cc-category-desc">${catText(key, "description")}</div>
            </div>`;
        }

        modal.innerHTML = `
            <div class="cc-prefs-header">
                <h2>${t("preferencesModal.title")}</h2>
                <button class="cc-prefs-close" data-cc="close-prefs">&times;</button>
            </div>
            ${catHTML}
            <div class="cc-btn-group" style="margin-top:1rem;">
                <button class="cc-btn cc-btn-primary" data-cc="prefs-accept-all">${t("preferencesModal.acceptAllBtn")}</button>
                <button class="cc-btn cc-btn-secondary" data-cc="prefs-save">${t("preferencesModal.savePreferencesBtn")}</button>
                <button class="cc-btn cc-btn-secondary" data-cc="prefs-accept-necessary">${t("preferencesModal.acceptNecessaryBtn")}</button>
            </div>
        `;
        return modal;
    }

    function buildOverlay() {
        const el = document.createElement("div");
        el.id = "cc-overlay";
        return el;
    }

    function buildToggle() {
        const el = document.createElement("div");
        el.id = "cc-fab";
        el.innerHTML = "&#x1F36A;"; // cookie emoji
        el.title = t("consentModal.showPreferencesBtn") || "Cookie settings";
        return el;
    }

    /* ================================================================
       CONSENT LOGIC
       ================================================================ */
    function getAllCategories() {
        return Object.keys(_config.categories);
    }

    function getNecessaryCategories() {
        return Object.entries(_config.categories)
            .filter(([, v]) => v.readOnly)
            .map(([k]) => k);
    }

    function acceptCategories(cats, isFirst) {
        const cookie = readCookie() || {};
        const prevCats = cookie.categories || [];
        const consentId = cookie.consentId || uuid();
        const now = Date.now();
        const exp = now + _config.cookie.expiresAfterDays * 86400000;

        const newCookie = {
            consentId: consentId,
            consentTimestamp: cookie.consentTimestamp || new Date(now).toISOString(),
            lastConsentTimestamp: new Date(now).toISOString(),
            categories: cats,
            expirationTime: exp,
        };

        writeCookie(newCookie);

        // Block cookies from rejected categories
        blockRejectedCookies(cats);

        // Hide modals, show toggle
        hideConsentModal();
        hidePrefsModal();
        showFab();

        // Fire events
        const detail = { cookie: newCookie };
        if (isFirst) {
            dispatch("cc:onFirstConsent", detail);
            if (_config.onFirstConsent) _config.onFirstConsent(detail);
        }
        dispatch("cc:onConsent", detail);
        if (_config.onConsent) _config.onConsent(detail);

        // Detect changes
        const changed = cats.filter((c) => !prevCats.includes(c))
            .concat(prevCats.filter((c) => !cats.includes(c)));
        if (changed.length && !isFirst) {
            const changeDetail = { cookie: newCookie, changedCategories: changed };
            dispatch("cc:onChange", changeDetail);
            if (_config.onChange) _config.onChange(changeDetail);
        }

        // Manage script tags
        manageScriptTags(cats);
    }

    function blockRejectedCookies(acceptedCats) {
        for (const [key, cat] of Object.entries(_config.categories)) {
            if (acceptedCats.includes(key)) continue;
            if (cat.autoClear && cat.autoClear.cookies) {
                for (const c of cat.autoClear.cookies) {
                    eraseCookie(c.name);
                }
            }
        }
    }

    function manageScriptTags(acceptedCats) {
        const scripts = $$("script[type='text/plain'][data-category]");
        scripts.forEach((s) => {
            const cat = s.getAttribute("data-category");
            if (acceptedCats.includes(cat)) {
                const ns = document.createElement("script");
                for (const attr of s.attributes) {
                    if (attr.name === "type" || attr.name === "data-category") continue;
                    ns.setAttribute(attr.name, attr.value);
                }
                ns.textContent = s.textContent;
                s.parentNode.replaceChild(ns, s);
            }
        });
    }

    function dispatch(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    /* ================================================================
       SHOW / HIDE
       ================================================================ */
    function showConsentModal() {
        _consentModal && _consentModal.classList.add("cc-show");
        _overlay && _overlay.classList.add("cc-show");
    }
    function hideConsentModal() {
        _consentModal && _consentModal.classList.remove("cc-show");
        _overlay && _overlay.classList.remove("cc-show");
    }
    function showPrefsModal() {
        hideConsentModal();
        _prefsModal && _prefsModal.classList.add("cc-show");
        _overlay && _overlay.classList.add("cc-show");

        // Sync toggles with current cookie
        const cookie = readCookie();
        if (cookie && cookie.categories) {
            $$("input[data-cat]", _prefsModal).forEach((inp) => {
                if (!inp.disabled) {
                    inp.checked = cookie.categories.includes(inp.dataset.cat);
                }
            });
        }
    }
    function hidePrefsModal() {
        _prefsModal && _prefsModal.classList.remove("cc-show");
        _overlay && _overlay.classList.remove("cc-show");
    }
    function showFab() { _toggle && _toggle.classList.add("cc-show"); }
    function hideFab() { _toggle && _toggle.classList.remove("cc-show"); }

    /* ================================================================
       EVENT BINDING
       ================================================================ */
    function bindEvents() {
        document.addEventListener("click", (e) => {
            const el = e.target.closest("[data-cc]");
            if (!el) return;
            const action = el.getAttribute("data-cc");
            const isFirst = !readCookie();

            switch (action) {
                case "accept-all":
                case "prefs-accept-all":
                    acceptCategories(getAllCategories(), isFirst);
                    break;
                case "accept-necessary":
                case "prefs-accept-necessary":
                    acceptCategories(getNecessaryCategories(), isFirst);
                    break;
                case "show-prefs":
                    showPrefsModal();
                    break;
                case "close-prefs":
                    hidePrefsModal();
                    // Re-show consent modal if no consent yet
                    if (!readCookie()) showConsentModal();
                    break;
                case "prefs-save": {
                    const selected = [];
                    $$("input[data-cat]", _prefsModal).forEach((inp) => {
                        if (inp.checked) selected.push(inp.dataset.cat);
                    });
                    // Always include necessary
                    for (const n of getNecessaryCategories()) {
                        if (!selected.includes(n)) selected.push(n);
                    }
                    acceptCategories(selected, isFirst);
                    break;
                }
            }
        });

        // FAB opens preferences
        _toggle && _toggle.addEventListener("click", () => {
            showPrefsModal();
        });

        // Overlay click closes prefs
        _overlay && _overlay.addEventListener("click", () => {
            if (_prefsModal.classList.contains("cc-show")) {
                hidePrefsModal();
                if (!readCookie()) showConsentModal();
            }
        });
    }

    /* ================================================================
       PUBLIC API  — compatible with the original script's calls
       ================================================================ */
    const API = {
        /**
         * Initialise the banner.
         * @param {Object} userConfig  Optional overrides merged into defaults.
         */
        init(userConfig) {
            _config = deepMerge(DEFAULTS, userConfig || {});

            // Language detection — priority: 1) <html lang>, 2) browser language, 3) default
            if (_config.autoDetectLanguage) {
                let detected = "";

                // 1. Check the <html lang="..."> attribute
                const docLang = (document.documentElement.lang || "").slice(0, 2).toLowerCase();
                if (docLang && _config.languages[docLang]) {
                    detected = docLang;
                }

                // 2. Fall back to the visitor's browser / OS language
                if (!detected) {
                    const browserLangs = navigator.languages
                        ? navigator.languages.map((l) => l.slice(0, 2).toLowerCase())
                        : [(navigator.language || navigator.userLanguage || "").slice(0, 2).toLowerCase()];

                    for (const bl of browserLangs) {
                        if (bl && _config.languages[bl]) {
                            detected = bl;
                            break;
                        }
                    }
                }

                // 3. Ultimate fallback
                _lang = detected || _config.defaultLanguage;
            } else {
                _lang = _config.defaultLanguage;
            }

            // Inject styles & build DOM
            injectStyles();
            _overlay = buildOverlay();
            _consentModal = buildConsentModal();
            _prefsModal = buildPrefsModal();
            _toggle = buildToggle();

            document.body.appendChild(_overlay);
            document.body.appendChild(_consentModal);
            document.body.appendChild(_prefsModal);
            document.body.appendChild(_toggle);

            bindEvents();

            // If consent already exists, just show FAB + fire onConsent
            const existing = readCookie();
            if (existing && existing.categories) {
                showFab();
                manageScriptTags(existing.categories);
                dispatch("cc:onConsent", { cookie: existing });
                if (_config.onConsent) _config.onConsent({ cookie: existing });
            } else {
                showConsentModal();
            }
        },

        /** Show the consent modal programmatically. */
        show() { showConsentModal(); },

        /** Show the preferences modal programmatically. */
        showPreferences() { showPrefsModal(); },

        /** Get the stored cookie object (or null). */
        getCookie() { return readCookie(); },

        /** Check if a valid consent cookie exists. */
        validConsent() { const c = readCookie(); return !!(c && c.categories && c.categories.length); },

        /** Get a config value. */
        getConfig(key) { return key ? _config[key] : _config; },

        /** Erase a cookie by name. */
        eraseCookies(name) { eraseCookie(name); },

        /** Set the UI language ('th' | 'en'). Rebuilds the modals. */
        setLanguage(lang) {
            if (!_config.languages[lang]) return;
            _lang = lang;
            // Rebuild modals
            const hadConsent = _consentModal.classList.contains("cc-show");
            const hadPrefs = _prefsModal.classList.contains("cc-show");
            _consentModal.remove(); _prefsModal.remove(); _toggle.remove();
            _consentModal = buildConsentModal();
            _prefsModal = buildPrefsModal();
            _toggle = buildToggle();
            document.body.appendChild(_consentModal);
            document.body.appendChild(_prefsModal);
            document.body.appendChild(_toggle);
            _toggle.addEventListener("click", () => showPrefsModal());
            if (hadConsent) showConsentModal();
            if (hadPrefs) showPrefsModal();
            if (readCookie()) showFab();
        },

        /** Reset consent — deletes cookie and optionally reloads. */
        reset(reload) {
            const c = _config.cookie;
            eraseCookie(c.name);
            hideFab(); hidePrefsModal();
            if (reload) location.reload();
            else showConsentModal();
        },
    };

    /* ================================================================
       EXPOSE GLOBALLY
       ================================================================ */
    window.CookieConsent = API;

    /* Auto-init when DOM is ready if no manual init is expected */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            // Auto-init after a tick so users can call .init() themselves first
            setTimeout(() => { if (!_consentModal) API.init(); }, 0);
        });
    } else {
        setTimeout(() => { if (!_consentModal) API.init(); }, 0);
    }
})();

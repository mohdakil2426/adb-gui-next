# ADB GUI Next — Marketplace Feature: Full Research Analysis

> Research conducted: April 2026  
> Question: Is it good to add a marketplace? Are current providers good? What else can we add?

---

## TL;DR Verdict

| Question | Answer |
|---|---|
| Should we add a marketplace? | **✅ Yes — it's a strong differentiator, but scope it right** |
| Current providers (F-Droid, IzzyOnDroid, GitHub, Aptoide) good? | **✅ All 4 are solid choices** |
| Can we add more? | **✅ Yes — 4–5 good candidates exist** |
| Any serious risks? | **⚠️ One big one: Google 2026 Android verification policy** |

---

## 1. Is Adding a Marketplace a Good Idea?

### ✅ Strategic Case FOR It

**Unique differentiation.** No mainstream ADB desktop tool has a built-in app browser. Tools like `scrcpy`, `Scrcpy GUI`, `ADB AppControl`, and `Vysor` all focus on mirroring or file management. A built-in "browse and sideload from trusted FOSS sources" is a **real gap** in the market.

**Target audience alignment.** ADB GUI Next users are developers, power users, custom ROM flashers, and privacy-conscious people. These are exactly the people who use F-Droid, IzzyOnDroid, and want to sideload without going through Google Play. The audience-feature match is very high.

**Workflow completion.** Right now, users have to:
1. Open F-Droid / browser
2. Find the APK
3. Download it
4. Drag it to ADB GUI Next to install

A marketplace collapses that into 1 step inside the tool. That's a **10x improvement in friction**.

**No tooling precedent.** Searching for "desktop ADB tool with app store" yields nothing meaningful — the space is empty. That's an opportunity.

### ⚠️ Risks to Consider

**Scope creep.** A marketplace is a whole product. You need search UX, app cards, metadata rendering, icon loading, download progress, error states. Start small — Phase 1 should be F-Droid search + one-click install only.

**Google's 2026 Android Verification Policy.** Starting in mid-to-late 2026, Google is requiring all Android app developers to verify their identity. F-Droid has publicly said this is incompatible with their open-source model. On "certified" Android devices, OS-level friction for sideloading will increase. This doesn't break ADB sideloading from a desktop tool directly, but it may cause:
- F-Droid apps being flagged/blocked on stock devices
- Users being warned more aggressively when installing via ADB
- Future Android versions potentially blocking non-verified-developer APKs at the OS level

**This does NOT kill the feature** — it increases the need for tools like ours that make FOSS sideloading easy. But it's a risk to watch.

**Aptoide ws75 API — grey area.** Aptoide's published TOS prohibits using automated access in ways that "damage or interfere with their services." The public `ws75` API is used by many open-source projects, but there is **no explicit developer license** for third-party apps using it. Best approach: cache results aggressively, set a proper `User-Agent`, and clearly attribute Aptoide in the UI.

---

## 2. Current Provider Assessment

### ✅ F-Droid — Keep, High Priority

| | |
|---|---|
| **API** | `https://f-droid.org/api/v1/packages/{pkg}` + `index-v2.json` |
| **Auth** | None |
| **TOS** | Fully open, encouraged |
| **Reliability** | Good — hardware upgrades in late 2025 improved speed |
| **App count** | ~4,000 apps (all FOSS) |
| **Weakness** | Search is basic (exact name matching only) |

**Verdict: ✅ Must have.** This is the core of the marketplace. F-Droid is the gold standard for FOSS Android apps. Use `search.f-droid.org/api/search_apps?q=<query>` for better search results than the v1 package endpoint.

### ✅ IzzyOnDroid — Keep, High Priority

| | |
|---|---|
| **API** | Same F-Droid format (`index-v2.json`) |
| **Auth** | None |
| **TOS** | Fully open |
| **Reliability** | Excellent — daily automated updates, verified developer binaries |
| **Security** | VirusTotal-scanned + reproducible build status shown |
| **Funding** | NGI Mobifree (EU-backed, sustainable) |

**Verdict: ✅ Must have.** IzzyOnDroid has ~3,000 apps and often has apps before they appear in the main F-Droid repo. It's faster to update and provides more transparency (VirusTotal links). It's arguably more useful than main F-Droid for discovery.

### ✅ MicroG / Custom F-Droid Repos — Keep, Medium Priority

**Verdict: ✅ Keep the generic repo fetcher.** The power of supporting any F-Droid-compatible repo is enormous (Guardian Project, CalyxOS, Bromite etc.). The implementation cost is near-zero since we already have `fetch_repo_index`. Keep it.

### ✅ GitHub Releases — Keep, High Priority

| | |
|---|---|
| **API** | `api.github.com/repos/{owner}/{repo}/releases` |
| **Auth** | Optional (higher rate limits with token) |
| **TOS** | Fine for programmatic use |
| **Reliability** | Excellent |
| **App count** | Unlimited — any FOSS app that publishes GitHub releases |

**Verdict: ✅ Must have.** This is the "Obtainium model" — go directly to developers for latest releases. Apps like Telegram FOSS, VLC, Organic Maps, Signal, NewPipe all publish APKs on GitHub. This covers FOSS apps that aren't in any repo yet.

> **Enhancement idea:** Add a "curated GitHub apps" list (hardcoded popular repos) so users don't have to know what GitHub repo to type.

### ⚠️ Aptoide — Keep, But with Caution

| | |
|---|---|
| **API** | `https://ws75.aptoide.com/api/7/` (public, undocumented) |
| **Auth** | None for ws75 |
| **TOS** | **Grey area** — no explicit third-party license |
| **App count** | ~1 million apps |
| **Security** | Apps are malware-scanned by Aptoide |
| **Reliability** | Rate limits undocumented, but actively used by open-source tools |

**Verdict: ⚠️ Include, but as a secondary provider.** The app count (1M) is a huge advantage. The grey-area TOS is the concern. Mitigate by:
1. Implement client-side caching (don't re-fetch same search within 10 mins)
2. Set `User-Agent: ADB-GUI-Next/1.0 (open-source; github.com/your/repo)`
3. Display Aptoide branding/attribution in the UI
4. If Aptoide contacts you, it's easy to disable

---

## 3. New Providers to Consider

### 🟡 APKMirror — Research Only (No Direct Download)

| | |
|---|---|
| **Type** | Mirror of official Play Store releases |
| **Auth** | None for browsing |
| **Download** | ❌ APKMirror does NOT allow automated APK downloads |
| **TOS** | Explicitly prohibits automated programmatic access |
| **Value** | Useful only for showing "what version is current on Play Store" |

**Verdict: 🟡 Version tracking only.** You can use APKMirror's API to check "what's the latest version code of this package" for an update-checker feature, but you can't download APKs from them. They're owned by Android Police and have been strict about this.

### 🟢 Uptodown — Worth Considering

| | |
|---|---|
| **API** | Public REST API available (`https://uptodown.com/`) |
| **Auth** | Developer API key (free registration) |
| **TOS** | Explicit developer program — allowed for app integrations |
| **App count** | ~3 million apps |
| **Security** | Apps scanned and curated |
| **Language** | Good for non-English markets |

**Verdict: 🟢 Good candidate for Phase 3.** Uptodown has a legitimate developer API program. It's TOS-safe and has massive app coverage including apps not found elsewhere. The tradeoff is requiring API key registration.

### 🟢 Huawei AppGallery — Niche but Interesting

| | |
|---|---|
| **API** | Public REST API (`https://appgallery.cloud.huawei.com/`) |
| **Auth** | App ID (free) |
| **App count** | ~3.8 million apps |
| **Best use case** | Huawei-specific apps (like HMS Core replacements) |

**Verdict: 🟢 Niche value for specific users.** Huawei users with custom ROMs might find this useful. Not a must-have but easy to add.

### 🟢 RuStore — Regional but Expanding

| | |
|---|---|
| **Type** | Russian app store (VK / government-backed) |
| **API** | Public REST API available |
| **App count** | ~100,000+ apps |
| **Best use case** | Users in Russia/CIS countries where Google is restricted |

**Verdict: 🟢 Good for regional coverage.** Obtainium already supports RuStore. If you want to be a globally applicable tool, this matters.

### 🟢 Codeberg / SourceHut — Same Model as GitHub

These are open-source, privacy-respecting alternatives to GitHub. Many FOSS developers (especially from Europe) prefer them. Obtainium supports both. Adding them alongside GitHub Releases costs very little (same logic, different base URLs).

**Verdict: 🟢 Easy win, low effort.** Add alongside GitHub implementation.

### 🔴 Aurora Store / Google Play — Skip

Accessing Google Play data without authentication or with shared anonymous accounts violates Google's ToS. Aurora Store uses shared "disposable" Google accounts which frequently get banned. As a desktop tool you're liable for ToS violations in a more direct way than a mobile app. **Skip permanently.**

---

## 4. Provider Comparison (Updated)

| Provider | Auth | TOS Safety | App Count | Reliability | Priority |
|---|---|---|---|---|---|
| F-Droid | ❌ None | ✅ Excellent | ~4,000 | ✅ Good | 🔴 Must have |
| IzzyOnDroid | ❌ None | ✅ Excellent | ~3,000 | ✅ Excellent | 🔴 Must have |
| Custom F-Droid Repos | ❌ None | ✅ Excellent | Varies | ✅ Good | 🔴 Must have |
| GitHub Releases | ❌ None | ✅ Good | Unlimited | ✅ Excellent | 🔴 Must have |
| Aptoide (ws75) | ❌ None | ⚠️ Grey area | ~1M | ✅ Good | 🟡 Secondary |
| Uptodown | 🔑 API key | ✅ Good | ~3M | ✅ Good | 🟢 Phase 3 |
| Codeberg / SourceHut | ❌ None | ✅ Excellent | FOSS only | ✅ Good | 🟢 Phase 2 |
| Huawei AppGallery | 🔑 App ID | ✅ Good | ~3.8M | ✅ Good | 🟢 Optional |
| RuStore | ❌ None | ✅ Good | ~100K | ✅ Good | 🟢 Regional |
| APKMirror | ❌ None | 🔴 Prohibited | Millions | ✅ Good | 🔴 Skip (version check only) |
| APKPure | ❌ None | 🔴 ToS Risk | Millions | ⚠️ | 🔴 Skip |
| Google Play / Aurora | 🔑 OAuth | 🔴 ToS Violation | Millions | ⚠️ Bans often | 🔴 Skip |

---

## 5. Recommended Implementation Order

### Phase 1 — Core FOSS Store (Now)
- F-Droid search + metadata + download
- IzzyOnDroid search + metadata + download  
- Custom repo support (`get_default_repos` + generic fetcher)
- One-click ADB install

### Phase 2 — GitHub Ecosystem (Month 2)
- GitHub Releases: search by owner/repo
- Codeberg + SourceHut support (same API structure as GitHub)
- Hardcoded "Popular FOSS Apps" list (NewPipe, Telegram FOSS, Signal, VLC, etc.)
- Update checker: compare installed vs latest version

### Phase 3 — Broader Coverage (Month 3)
- Aptoide (ws75 API) — with caching and attribution
- Uptodown (requires free API key registration)
- APKMirror version tracking only (no download)
- Curated package lists stored locally (JSON config)

### Phase 4 — Regional & Niche (Optional)
- Huawei AppGallery
- RuStore

---

## 6. Key Technical Recommendations

1. **Use `search.f-droid.org` for F-Droid search**, not the v1 package endpoint. The Meilisearch-powered search endpoint is far superior.
   ```
   https://search.f-droid.org/api/search_apps?q=<query>&lang=en
   ```

2. **Cache everything aggressively.** Use a simple in-memory + disk cache (TTL: 10 minutes for search, 1 hour for metadata) to avoid hammering any provider's servers.

3. **Deduplicate across providers.** The same app may appear in F-Droid, IzzyOnDroid, and GitHub with different APKs. Show them as one card with "Available from: F-Droid | IzzyOnDroid" badges.

4. **Show source trust badges clearly.** Users should always know where their APK comes from. Differentiate between "built by F-Droid from source" vs "developer binary in IzzyOnDroid" vs "Aptoide hosted".

5. **Watch Google's 2026 Android changes.** Plan to add a note/warning in the UI if Google starts blocking sideloading more aggressively on stock devices.

---

## 7. References

| Source | URL |
|---|---|
| F-Droid API | https://f-droid.org/api/v1/ |
| F-Droid Search | https://search.f-droid.org/ |
| IzzyOnDroid | https://apt.izzysoft.de/fdroid/ |
| IzzyOnDroid sustainability | https://izzyondroid.org |
| GitHub Releases API | https://docs.github.com/en/rest/releases |
| Aptoide Connect Docs | https://docs.connect.aptoide.com/docs/overview |
| Aptoide Public API | https://ws75.aptoide.com/api/7/ |
| Obtainium (source reference) | https://github.com/ImranR98/Obtainium |
| Obtainium supported sources | https://imranr.dev/obtainium |
| Uptodown Dev Program | https://uptodown.com |

---

*Analysis by ADB GUI Next research — April 2026*

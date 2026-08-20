# Comprehensive Research Report: Expanding Firmware Hub with Samsung & OnePlus Ecosystems

**Document ID**: `REPORT-2026-08-20-FIRMWARE-HUB-SAMSUNG-ONEPLUS`  
**Date**: 2026-08-20  
**Status**: Approved for Implementation / Architecture Blueprint  
**Target Systems**: `adb-gui-next` Firmware Hub, Tauri 2 Rust Backend, React 19 / TypeScript UI  
**Scope**: OnePlus (OxygenOS/ColorOS) OTA & Archive Infrastructure, Samsung (Galaxy FOTA / FUS / doc.html / Multi-file Firmware) Infrastructure, Model Catalog Taxonomy (>50 OnePlus models, >70 Samsung models), Live Scraper APIs, Fallback Static Catalogs, Rust `FirmwareProvider` Implementations, Frontend Brand Filter Integration, and Real-Time Memory Bank / Documentation Updates.

---

## Table of Contents
1. [Executive Summary & Objectives](#1-executive-summary--objectives)
2. [OnePlus Firmware Architecture & Ecosystem Analysis](#2-oneplus-firmware-architecture--ecosystem-analysis)
   - 2.1 [OTA Server Topography & CDN Evolution (`allawnofs.com`, `googleapis.com`, `archive.org`)](#21-ota-server-topography--cdn-evolution)
   - 2.2 [Payload Distribution & `payload.bin` Packaging](#22-payload-distribution--payloadbin-packaging)
   - 2.3 [Live Scraper & Dynamic Ingestion Channels](#23-live-scraper--dynamic-ingestion-channels)
3. [Samsung Firmware Architecture & Ecosystem Analysis](#3-samsung-firmware-architecture--ecosystem-analysis)
   - 3.1 [Samsung FOTA & FUS Architecture (`fota-cloud-dn.ospserver.net`)](#31-samsung-fota--fus-architecture)
   - 3.2 [Official Release Tracking via `doc.samsungmobile.com`](#32-official-release-tracking-via-docsamsungmobilecom)
   - 3.3 [Multi-File Package Structure (AP / BL / CP / CSC) & SamFW Portal Integration](#33-multi-file-package-structure-ap--bl--cp--csc--samfw-portal-integration)
4. [Comprehensive Device Model Taxonomy](#4-comprehensive-device-model-taxonomy)
   - 4.1 [OnePlus Model Catalog Matrix (50+ Models Across All Generations)](#41-oneplus-model-catalog-matrix)
   - 4.2 [Samsung Model Catalog Matrix (70+ Models Across All Flagship & Mid-Range Series)](#42-samsung-model-catalog-matrix)
5. [Rust Backend Implementation Architecture](#5-rust-backend-implementation-architecture)
   - 5.1 [OnePlus Provider (`OnePlusProvider`) Design & Implementation](#51-oneplus-provider-oneplusprovider-design--implementation)
   - 5.2 [Samsung Provider (`SamsungProvider`) Design & Implementation](#52-samsung-provider-samsungprovider-design--implementation)
   - 5.3 [FirmwareHubService Registration & Trait Polymorphism](#53-firmwarehubservice-registration--trait-polymorphism)
6. [Frontend UI & Catalog Integration](#6-frontend-ui--catalog-integration)
   - 6.1 [Brand Filter Badges & Counts](#61-brand-filter-badges--counts)
   - 6.2 [Direct Remote Extraction Integration with Payload Dumper](#62-direct-remote-extraction-integration-with-payload-dumper)
7. [Verification & Real-Time Documentation Synchronization](#7-verification--real-time-documentation-synchronization)

---

## 1. Executive Summary & Objectives

The `adb-gui-next` Firmware Hub provides a unified, zero-friction catalog of official Android device firmware packages with direct one-click remote inspection, payload dumping, and local flashing preparation. Currently, the catalog includes Google Pixel, Nothing OS, and Xiaomi/POCO/Redmi devices.

The goal of this expansion is to add native, production-grade support for **Samsung** and **OnePlus**, incorporating maximum feasible model coverage across modern flagships, legacy community favorites, foldables, tablets, and budget-friendly series.

### Key Deliverables
1. **OnePlus Firmware Engine**:
   - Live GitHub release ingestion from community archives (`spike0en/oneplus_archive`).
   - Direct download links to official CDN servers (`gauss-compota` / `allawnofs.com`, `googleapis.com`, `archive.org`).
   - Rich static catalog encompassing 50+ OnePlus devices from the OnePlus 13/13R, 12/12R, 11/11R, 10/9/8/7/6/5/3/2/One series, Open foldables, Pad tablets, and the entire Nord lineup.
2. **Samsung Firmware Engine**:
   - Live Samsung FOTA / version.xml querying (`fota-cloud-dn.ospserver.net`) and changelog ingestion (`doc.samsungmobile.com`).
   - Comprehensive model database of 70+ Samsung Galaxy devices (S-Series from S25 down to S7, Z Fold & Flip series, Note series, A-Series bestsellers, M/F series, and Galaxy Tab S/A series).
   - Multi-file firmware download integration via SamFW and direct FOTA links.
3. **Seamless Frontend Experience**:
   - Dynamic brand filtering, accurate device counts, and clean device titles.
   - Immediate compatibility with Payload Dumper's remote HTTP range ZIP extractor and local flashing tools.

---

## 2. OnePlus Firmware Architecture & Ecosystem Analysis

### 2.1 OTA Server Topography & CDN Evolution
OnePlus has evolved its firmware distribution infrastructure across multiple generations:
1. **ColorOS/Oplus Unified CDN (`allawnofs.com` & `gauss-compota`)**: The primary high-speed delivery network for OxygenOS 13/14/15 and ColorOS packages. Regional buckets include `gauss-compota-c-in.allawnofs.com` (India), `gauss-compota-c-eu.allawnofs.com` (Europe), `gauss-compota-c-sg.allawnofs.com` (Singapore / Southeast Asia), and `gauss-compota-c-cn.allawnfs.com` (China).
2. **Google OTA Proxy (`android.googleapis.com/packages/ota-api/package/...`)**: Standard Android OTA hosting used for North American (NA) and Global (GLO) OxygenOS builds.
3. **Community Long-Term Preservation (`archive.org/download/oneplus_archive/...`)**: Verified full OTA packages stored for permanent preservation and fast range-based partition inspection.

### 2.2 Payload Distribution & `payload.bin` Packaging
All modern OnePlus full firmware updates (OxygenOS 11, 12, 13, 14, 15) are standard AOSP-compliant ZIP archives containing an uncompressed `payload.bin` along with `META-INF/com/android/metadata` and `payload_properties.txt`. The `payload.bin` encapsulates:
- Core boot partitions: `boot`, `init_boot`, `vendor_boot`, `dtbo`, `vbmeta`, `vbmeta_system`, `vbmeta_vendor`.
- Dynamic Super partitions: `system`, `system_ext`, `product`, `vendor`, `odm`, `my_product`, `my_stock`, `my_heytap`, `my_carrier`.

### 2.3 Live Scraper & Dynamic Ingestion Channels
The `OnePlusProvider` queries the GitHub releases API for `spike0en/oneplus_archive` to discover newly published full OTA packages and extract firmware links, build IDs, Android versions, and regional carrier tags (`IN`, `EU`, `NA`, `GLO`, `CN`).

---

## 3. Samsung Firmware Architecture & Ecosystem Analysis

### 3.1 Samsung FOTA & FUS Architecture
Samsung distributes software updates through its Firmware Update Server (FUS) infrastructure:
- **Endpoint**: `https://fota-cloud-dn.ospserver.net/firmware/{csc}/{model}/version.xml`
- **User-Agent**: `Kies2.0_FUS`
- **Output**: Structured XML with the latest available firmware build triple: `PDA / CSC / PHONE` (e.g. `S928BXXS6DZG1/S928BOXM6DZG1/S928BXXS6DZG1`).

### 3.2 Official Release Tracking via `doc.samsungmobile.com`
For detailed release histories, security patch dates, and Android OS versions, Samsung maintains public web changelogs at:
- `https://doc.samsungmobile.com/{model}/{csc}/doc.html` -> embedded `../../{model}/{nonce}/eng.html`
- Contains canonical device marketing names (e.g. `Galaxy S24 Ultra (SM-S928B)`), build numbers, release dates, and security patch levels.

### 3.3 Multi-File Package Structure (AP / BL / CP / CSC) & SamFW Portal Integration
Samsung factory firmware consists of 5 binary archives compressed with LZ4:
1. `AP_*.tar.md5`: System, recovery, boot, init_boot, super images.
2. `BL_*.tar.md5`: Bootloader, sboot, tz, param, tzsw.
3. `CP_*.tar.md5`: Baseband modem radio.
4. `CSC_*.tar.md5`: Regional carrier customization (wipes user data).
5. `HOME_CSC_*.tar.md5`: Regional customization without user data wipe.

The `SamsungProvider` indexes direct SamFW download portal links (`https://samfw.com/firmware/{model}/{csc}`) alongside official Samsung update builds.

---

## 4. Comprehensive Device Model Taxonomy

### 4.1 OnePlus Model Catalog Matrix (50+ Models)

| Category | Model Name | Codename / Model Number | SoC | Release Year |
|---|---|---|---|---|
| **Flagship** | OnePlus 13 | infiniti / PJZ110, CPH2749, CPH2745, CPH2747 | Snapdragon 8 Elite | 2024 |
| **Flagship** | OnePlus 13R | dodge / PJZ110, CPH2649, CPH2655, CPH2653 | Snapdragon 8 Gen 3 | 2025 |
| **Flagship** | OnePlus 12 | waffle / PJD110, CPH2573, CPH2583, CPH2581 | Snapdragon 8 Gen 3 | 2024 |
| **Flagship** | OnePlus 12R / Ace 3 | aston / PJE110, CPH2585, CPH2609 | Snapdragon 8 Gen 2 | 2024 |
| **Flagship** | OnePlus 11 5G | salami / PHB110, CPH2447, CPH2449, CPH2451 | Snapdragon 8 Gen 2 | 2023 |
| **Flagship** | OnePlus 11R / Ace 2 | corvette / PHK110, CPH2487 | Snapdragon 8+ Gen 1 | 2023 |
| **Flagship** | OnePlus 10 Pro 5G | ne2211 / NE2210, NE2211, NE2213, NE2215 | Snapdragon 8 Gen 1 | 2022 |
| **Flagship** | OnePlus 10T 5G / Ace Pro | oval / PGP110, CPH2413, CPH2415, CPH2417 | Snapdragon 8+ Gen 1 | 2022 |
| **Flagship** | OnePlus 10R 5G / Ace | pickle / PGZ110, CPH2411, CPH2423 | Dimensity 8100-Max | 2022 |
| **Flagship** | OnePlus 9 Pro 5G | lemonadep / LE2120, LE2121, LE2123, LE2125 | Snapdragon 888 | 2021 |
| **Flagship** | OnePlus 9 5G | lemonade / LE2110, LE2111, LE2113, LE2115 | Snapdragon 888 | 2021 |
| **Flagship** | OnePlus 9RT 5G | martini / MT2110, MT2111 | Snapdragon 888 | 2021 |
| **Flagship** | OnePlus 9R 5G | lemonades / LE2100, LE2101 | Snapdragon 870 | 2021 |
| **Flagship** | OnePlus 8T | kebab / KB2000, KB2001, KB2003, KB2005 | Snapdragon 865 | 2020 |
| **Flagship** | OnePlus 8 Pro | instantnoodlep / IN2020, IN2021, IN2023, IN2025 | Snapdragon 865 | 2020 |
| **Flagship** | OnePlus 8 | instantnoodle / IN2010, IN2011, IN2013, IN2015 | Snapdragon 865 | 2020 |
| **Legacy Flagship** | OnePlus 7T Pro | hotdog / HD1910, HD1911, HD1913, HD1917 | Snapdragon 855+ | 2019 |
| **Legacy Flagship** | OnePlus 7T | hotdogg / HD1900, HD1901, HD1903, HD1905 | Snapdragon 855+ | 2019 |
| **Legacy Flagship** | OnePlus 7 Pro | guacamole / GM1910, GM1911, GM1913, GM1917 | Snapdragon 855 | 2019 |
| **Legacy Flagship** | OnePlus 7 | guacamoleb / GM1900, GM1901, GM1903 | Snapdragon 855 | 2019 |
| **Legacy Flagship** | OnePlus 6T | fajita / ONEPLUS A6010, A6013 | Snapdragon 845 | 2018 |
| **Legacy Flagship** | OnePlus 6 | enchilada / ONEPLUS A6000, A6003 | Snapdragon 845 | 2018 |
| **Legacy Flagship** | OnePlus 5T | dumpling / ONEPLUS A5010 | Snapdragon 835 | 2017 |
| **Legacy Flagship** | OnePlus 5 | cheeseburger / ONEPLUS A5000 | Snapdragon 835 | 2017 |
| **Legacy Flagship** | OnePlus 3T | oneplus3 / ONEPLUS A3010 | Snapdragon 821 | 2016 |
| **Legacy Flagship** | OnePlus 3 | oneplus3 / ONEPLUS A3000, A3003 | Snapdragon 820 | 2016 |
| **Legacy Flagship** | OnePlus 2 | oneplus2 / ONEPLUS A2001, A2003 | Snapdragon 810 | 2015 |
| **Legacy Flagship** | OnePlus One | bacon / A0001 | Snapdragon 801 | 2014 |
| **Legacy Flagship** | OnePlus X | onyx / E1001, E1003, E1005 | Snapdragon 801 | 2015 |
| **Foldables** | OnePlus Open | pagani / PKX110, CPH2551 | Snapdragon 8 Gen 2 | 2023 |
| **Tablets** | OnePlus Pad 2 | erhai / OPD2413, OPD2415 | Snapdragon 8 Gen 3 | 2024 |
| **Tablets** | OnePlus Pad | ktm / OPD2203 | Dimensity 9000 | 2023 |
| **Tablets** | OnePlus Pad Go | OPD2304, OPD2305 | Helio G99 | 2023 |
| **Nord Series** | OnePlus Nord 4 5G | audi / CPH2661, CPH2663 | Snapdragon 7+ Gen 3 | 2024 |
| **Nord Series** | OnePlus Nord 3 5G | vitamin / CPH2491, CPH2493 | Dimensity 9000 | 2023 |
| **Nord Series** | OnePlus Nord 2T 5G | karen / CPH2399, CPH2401 | Dimensity 1300 | 2022 |
| **Nord Series** | OnePlus Nord 2 5G | denniz / DN2101, DN2103 | Dimensity 1200-AI | 2021 |
| **Nord Series** | OnePlus Nord | avicii / AC2001, AC2003 | Snapdragon 765G | 2020 |
| **Nord Series** | OnePlus Nord CE4 5G | CPH2613 | Snapdragon 7 Gen 3 | 2024 |
| **Nord Series** | OnePlus Nord CE4 Lite 5G | CPH2621 | Snapdragon 695 5G | 2024 |
| **Nord Series** | OnePlus Nord CE3 5G | CPH2569 | Snapdragon 782G | 2023 |
| **Nord Series** | OnePlus Nord CE3 Lite 5G | CPH2467, CPH2465 | Snapdragon 695 5G | 2023 |
| **Nord Series** | OnePlus Nord CE 2 5G | IV2201 | Dimensity 900 | 2022 |
| **Nord Series** | OnePlus Nord CE 5G | eb2101 / EB2101, EB2103 | Snapdragon 750G | 2021 |
| **Nord Series** | OnePlus Nord N30 5G | CPH2513, CPH2515 | Snapdragon 695 5G | 2023 |
| **Nord Series** | OnePlus Nord N20 5G | GN2200 | Snapdragon 695 5G | 2022 |
| **Nord Series** | OnePlus Nord N200 5G | DE2117, DE2118 | Snapdragon 480 5G | 2021 |
| **Nord Series** | OnePlus Nord N10 5G | billie / BE2026, BE2029 | Snapdragon 690 5G | 2020 |
| **Nord Series** | OnePlus Nord N100 | clover / BE2011, BE2013 | Snapdragon 460 | 2020 |
| **Ace Series** | OnePlus Ace 3V | PJF110 | Snapdragon 7+ Gen 3 | 2024 |
| **Ace Series** | OnePlus Ace 2V | PHP110 | Dimensity 9000 | 2023 |
| **Ace Series** | OnePlus Ace 2 Pro | PJA110 | Snapdragon 8 Gen 2 | 2023 |

---

### 4.2 Samsung Model Catalog Matrix (70+ Models)

| Series | Model Name | Model Code(s) | SoC | Release Year |
|---|---|---|---|---|
| **Galaxy S Flagship** | Galaxy S25 Ultra | SM-S938B, SM-S938U, SM-S938N | Snapdragon 8 Elite for Galaxy | 2025 |
| **Galaxy S Flagship** | Galaxy S25+ | SM-S936B, SM-S936U | Exynos 2500 / SD 8 Elite | 2025 |
| **Galaxy S Flagship** | Galaxy S25 | SM-S931B, SM-S931U | Exynos 2500 / SD 8 Elite | 2025 |
| **Galaxy S Flagship** | Galaxy S24 Ultra | SM-S928B, SM-S928U, SM-S928N | Snapdragon 8 Gen 3 for Galaxy | 2024 |
| **Galaxy S Flagship** | Galaxy S24+ | SM-S926B, SM-S926U, SM-S9260 | Exynos 2400 / SD 8 Gen 3 | 2024 |
| **Galaxy S Flagship** | Galaxy S24 | SM-S921B, SM-S921U, SM-S9210 | Exynos 2400 / SD 8 Gen 3 | 2024 |
| **Galaxy S Flagship** | Galaxy S24 FE | SM-S721B, SM-S721U | Exynos 2400e | 2024 |
| **Galaxy S Flagship** | Galaxy S23 Ultra | SM-S918B, SM-S918U, SM-S918N | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy S Flagship** | Galaxy S23+ | SM-S916B, SM-S916U | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy S Flagship** | Galaxy S23 | SM-S911B, SM-S911U | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy S Flagship** | Galaxy S23 FE | SM-S711B, SM-S711U | Exynos 2200 / SD 8 Gen 1 | 2023 |
| **Galaxy S Flagship** | Galaxy S22 Ultra | SM-S908B, SM-S908U, SM-S9080 | Snapdragon 8 Gen 1 / Exynos 2200 | 2022 |
| **Galaxy S Flagship** | Galaxy S22+ | SM-S906B, SM-S906U | Snapdragon 8 Gen 1 / Exynos 2200 | 2022 |
| **Galaxy S Flagship** | Galaxy S22 | SM-S901B, SM-S901U | Snapdragon 8 Gen 1 / Exynos 2200 | 2022 |
| **Galaxy S Flagship** | Galaxy S21 Ultra 5G | SM-G998B, SM-G998U, SM-G9980 | Snapdragon 888 / Exynos 2100 | 2021 |
| **Galaxy S Flagship** | Galaxy S21+ 5G | SM-G996B, SM-G996U | Snapdragon 888 / Exynos 2100 | 2021 |
| **Galaxy S Flagship** | Galaxy S21 5G | SM-G991B, SM-G991U | Snapdragon 888 / Exynos 2100 | 2021 |
| **Galaxy S Flagship** | Galaxy S21 FE 5G | SM-G990B, SM-G990U | Snapdragon 888 / Exynos 2100 | 2022 |
| **Galaxy S Flagship** | Galaxy S20 Ultra 5G | SM-G988B, SM-G988U | Snapdragon 865 / Exynos 990 | 2020 |
| **Galaxy S Flagship** | Galaxy S20+ 5G | SM-G986B, SM-G986U | Snapdragon 865 / Exynos 990 | 2020 |
| **Galaxy S Flagship** | Galaxy S20 5G | SM-G981B, SM-G981U | Snapdragon 865 / Exynos 990 | 2020 |
| **Galaxy S Flagship** | Galaxy S20 FE 5G | SM-G781B, SM-G781U, SM-G780G | Snapdragon 865 | 2020 |
| **Galaxy S Legacy** | Galaxy S10+ | SM-G975F, SM-G975U | Exynos 9820 / Snapdragon 855 | 2019 |
| **Galaxy S Legacy** | Galaxy S10 | SM-G973F, SM-G973U | Exynos 9820 / Snapdragon 855 | 2019 |
| **Galaxy S Legacy** | Galaxy S10e | SM-G970F, SM-G970U | Exynos 9820 / Snapdragon 855 | 2019 |
| **Galaxy S Legacy** | Galaxy S10 5G | SM-G977B, SM-G977U | Exynos 9820 / Snapdragon 855 | 2019 |
| **Galaxy S Legacy** | Galaxy S10 Lite | SM-G770F, SM-G770U | Snapdragon 855 | 2020 |
| **Galaxy S Legacy** | Galaxy S9+ | SM-G965F, SM-G965U | Exynos 9810 / Snapdragon 845 | 2018 |
| **Galaxy S Legacy** | Galaxy S9 | SM-G960F, SM-G960U | Exynos 9810 / Snapdragon 845 | 2018 |
| **Galaxy S Legacy** | Galaxy S8+ | SM-G955F, SM-G955U | Exynos 8895 / Snapdragon 835 | 2017 |
| **Galaxy S Legacy** | Galaxy S8 | SM-G950F, SM-G950U | Exynos 8895 / Snapdragon 835 | 2017 |
| **Galaxy S Legacy** | Galaxy S7 edge | SM-G935F, SM-G935U | Exynos 8890 / Snapdragon 820 | 2016 |
| **Galaxy S Legacy** | Galaxy S7 | SM-G930F, SM-G930U | Exynos 8890 / Snapdragon 820 | 2016 |
| **Galaxy Z Fold & Flip** | Galaxy Z Fold 6 | SM-F956B, SM-F956U, SM-F9560 | Snapdragon 8 Gen 3 for Galaxy | 2024 |
| **Galaxy Z Fold & Flip** | Galaxy Z Flip 6 | SM-F741B, SM-F741U, SM-F7410 | Snapdragon 8 Gen 3 for Galaxy | 2024 |
| **Galaxy Z Fold & Flip** | Galaxy Z Fold 5 | SM-F946B, SM-F946U, SM-F9460 | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy Z Fold & Flip** | Galaxy Z Flip 5 | SM-F731B, SM-F731U, SM-F7310 | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy Z Fold & Flip** | Galaxy Z Fold 4 | SM-F936B, SM-F936U | Snapdragon 8+ Gen 1 | 2022 |
| **Galaxy Z Fold & Flip** | Galaxy Z Flip 4 | SM-F721B, SM-F721U | Snapdragon 8+ Gen 1 | 2022 |
| **Galaxy Z Fold & Flip** | Galaxy Z Fold 3 5G | SM-F926B, SM-F926U | Snapdragon 888 | 2021 |
| **Galaxy Z Fold & Flip** | Galaxy Z Flip 3 5G | SM-F711B, SM-F711U | Snapdragon 888 | 2021 |
| **Galaxy Z Fold & Flip** | Galaxy Z Fold 2 5G | SM-F916B, SM-F916U | Snapdragon 865+ | 2020 |
| **Galaxy Z Fold & Flip** | Galaxy Z Flip 5G / Z Flip | SM-F707B, SM-F700F | Snapdragon 865+ / SD 855+ | 2020 |
| **Galaxy Z Fold & Flip** | Galaxy Fold 5G / Fold | SM-F907B, SM-F900F | Snapdragon 855 | 2019 |
| **Galaxy Note Series** | Galaxy Note 20 Ultra 5G | SM-N986B, SM-N986U, SM-N9860 | Snapdragon 865+ / Exynos 990 | 2020 |
| **Galaxy Note Series** | Galaxy Note 20 5G | SM-N981B, SM-N981U | Snapdragon 865+ / Exynos 990 | 2020 |
| **Galaxy Note Series** | Galaxy Note 10+ 5G / 10+ | SM-N976B, SM-N975F, SM-N975U | Exynos 9825 / Snapdragon 855 | 2019 |
| **Galaxy Note Series** | Galaxy Note 10 | SM-N970F, SM-N970U | Exynos 9825 / Snapdragon 855 | 2019 |
| **Galaxy Note Series** | Galaxy Note 10 Lite | SM-N770F | Exynos 9810 | 2020 |
| **Galaxy Note Series** | Galaxy Note 9 | SM-N960F, SM-N960U | Exynos 9810 / Snapdragon 845 | 2018 |
| **Galaxy Note Series** | Galaxy Note 8 | SM-N950F, SM-N950U | Exynos 8895 / Snapdragon 835 | 2017 |
| **Galaxy A Bestsellers** | Galaxy A55 5G | SM-A556B, SM-A556E, SM-A5560 | Exynos 1480 | 2024 |
| **Galaxy A Bestsellers** | Galaxy A54 5G | SM-A546B, SM-A546E, SM-A546U | Exynos 1380 | 2023 |
| **Galaxy A Bestsellers** | Galaxy A53 5G | SM-A536B, SM-A536E, SM-A536U | Exynos 1280 | 2022 |
| **Galaxy A Bestsellers** | Galaxy A52s 5G | SM-A528B | Snapdragon 778G 5G | 2021 |
| **Galaxy A Bestsellers** | Galaxy A52 5G | SM-A526B | Snapdragon 750G 5G | 2021 |
| **Galaxy A Bestsellers** | Galaxy A52 | SM-A525F, SM-A525M | Snapdragon 720G | 2021 |
| **Galaxy A Bestsellers** | Galaxy A51 | SM-A515F, SM-A516B | Exynos 9611 | 2019 |
| **Galaxy A Bestsellers** | Galaxy A50 | SM-A505F, SM-A505G | Exynos 9610 | 2019 |
| **Galaxy A Series** | Galaxy A35 5G | SM-A356B, SM-A356E | Exynos 1380 | 2024 |
| **Galaxy A Series** | Galaxy A34 5G | SM-A346B, SM-A346E | Dimensity 1080 | 2023 |
| **Galaxy A Series** | Galaxy A33 5G | SM-A336B, SM-A336E | Exynos 1280 | 2022 |
| **Galaxy A Series** | Galaxy A32 | SM-A325F, SM-A326B | Helio G80 / Dimensity 720 | 2021 |
| **Galaxy A Series** | Galaxy A25 5G | SM-A256B, SM-A256E | Exynos 1280 | 2023 |
| **Galaxy A Series** | Galaxy A24 | SM-A245F | Helio G99 | 2023 |
| **Galaxy A Series** | Galaxy A23 5G / A23 | SM-A236B, SM-A235F | Snapdragon 695 / SD 680 | 2022 |
| **Galaxy A Series** | Galaxy A15 5G / A15 | SM-A156B, SM-A155F | Dimensity 6100+ / Helio G99 | 2023 |
| **Galaxy A Series** | Galaxy A14 5G / A14 | SM-A146B, SM-A145F | Dimensity 700 / Exynos 1330 | 2023 |
| **Galaxy A Series** | Galaxy A13 | SM-A135F, SM-A137F | Exynos 850 / Helio G80 | 2022 |
| **Galaxy A Series** | Galaxy A05 / A05s | SM-A055F, SM-A057F | Helio G85 / Snapdragon 680 | 2023 |
| **Galaxy M & F Series** | Galaxy M55 5G | SM-M556B | Snapdragon 7 Gen 1 | 2024 |
| **Galaxy M & F Series** | Galaxy M54 5G | SM-M546B | Exynos 1380 | 2023 |
| **Galaxy M & F Series** | Galaxy M53 5G | SM-M536B | Dimensity 900 | 2022 |
| **Galaxy M & F Series** | Galaxy M34 5G / M33 | SM-M346B, SM-M336B | Exynos 1280 | 2023 |
| **Galaxy M & F Series** | Galaxy F54 5G | SM-E546B | Exynos 1380 | 2023 |
| **Galaxy Tab S Series** | Galaxy Tab S10 Ultra / S10+ | SM-X920, SM-X926B, SM-X820 | Dimensity 9300+ | 2024 |
| **Galaxy Tab S Series** | Galaxy Tab S9 Ultra / S9+ / S9 | SM-X910, SM-X810, SM-X710 | Snapdragon 8 Gen 2 for Galaxy | 2023 |
| **Galaxy Tab S Series** | Galaxy Tab S9 FE / FE+ | SM-X510, SM-X610 | Exynos 1380 | 2023 |
| **Galaxy Tab S Series** | Galaxy Tab S8 Ultra / S8+ / S8 | SM-X900, SM-X800, SM-X700 | Snapdragon 8 Gen 1 | 2022 |
| **Galaxy Tab S Series** | Galaxy Tab S7+ / S7 / S7 FE | SM-T970, SM-T870, SM-T733 | Snapdragon 865+ / SD 750G | 2020 |
| **Galaxy Tab A Series** | Galaxy Tab A9+ / A9 | SM-X210, SM-X110 | Snapdragon 695 / Helio G99 | 2023 |
| **Galaxy Tab A Series** | Galaxy Tab A8 10.5 | SM-X200, SM-X205 | Unisoc Tiger T618 | 2021 |
| **Galaxy Tab A Series** | Galaxy Tab A7 / A7 Lite | SM-T500, SM-T220 | Snapdragon 662 / Helio P22T | 2020 |

---

## 5. Rust Backend Implementation Architecture

### 5.1 OnePlus Provider (`OnePlusProvider`) Design
- Located in `src-tauri/src/firmware/providers/oneplus.rs`.
- Implements `FirmwareProvider` trait.
- Live scraper fetches GitHub releases from `spike0en/oneplus_archive` with a fast HTTP client (5s connect timeout, 10s request timeout).
- Parses release assets, SHA256 hashes, release notes, and links directly to official OTA payloads (`allawnofs.com`, `googleapis.com`, `archive.org`).
- Enriches devices with SoC chips, series categories ("OnePlus Flagship Series", "OnePlus Nord Series", "OnePlus Pad Series", "OnePlus Ace Series"), release years, and codenames.
- Deduplicates and merges with comprehensive static catalog of 50+ models.

### 5.2 Samsung Provider (`SamsungProvider`) Design
- Located in `src-tauri/src/firmware/providers/samsung.rs`.
- Implements `FirmwareProvider` trait.
- Live check queries Samsung FOTA server `https://fota-cloud-dn.ospserver.net/firmware/{csc}/{model}/version.xml` and changelogs on `doc.samsungmobile.com`.
- Static catalog contains 70+ verified Samsung models across Galaxy S, Z, Note, A, M, F, and Tab lines with exact model codes, SoC chips, release years, series tags, and SamFW portal / FUS build entries.

### 5.3 FirmwareHubService Registration
- Register both `OnePlusProvider` and `SamsungProvider` in `FirmwareHubService::new()`:
```rust
providers.insert(FirmwareBrand::Google, Arc::new(GooglePixelScraper::new()));
providers.insert(FirmwareBrand::Nothing, Arc::new(NothingProvider::new()));
providers.insert(FirmwareBrand::Xiaomi, Arc::new(XiaomiProvider::new()));
providers.insert(FirmwareBrand::OnePlus, Arc::new(OnePlusProvider::new()));
providers.insert(FirmwareBrand::Samsung, Arc::new(SamsungProvider::new()));
```

---

## 6. Frontend UI & Catalog Integration

- `FirmwareBrand` type in `models.ts` and `types.ts` is already `'google' | 'nothing' | 'xiaomi' | 'oneplus' | 'samsung'`.
- `BRAND_DISPLAY_INFO` contains accurate brand names, portal names, descriptions, and URLs.
- `useFirmwareCatalog` computes accurate brand counts and updates seamlessly when filtering by Samsung or OnePlus.
- Clicking any build provides one-click URL extraction in Payload Dumper with remote ZIP range inspection.

---

## 7. Verification & Real-Time Documentation Synchronization

1. **Rust Backend Tests**:
   - Add unit tests for `OnePlusProvider` (catalog parsing, metadata enrichment, static catalog validation).
   - Add unit tests for `SamsungProvider` (FOTA XML parsing, doc.html parser, static catalog validation).
2. **Clippy & Formatting**:
   - `cargo fmt --all --check` & `cargo clippy --all-targets -- -D warnings`.
3. **Frontend Tests**:
   - `npx vitest run` & `bun run build`.
4. **Documentation & Memory Bank**:
   - Update `docs/architecture.md`, `memory-bank/systemPatterns.md`, `memory-bank/activeContext.md`, and `memory-bank/progress.md`.

# Design: Capacitor Mobile Setup + HACCP Label Scan

**Date:** 2026-04-20  
**Status:** Approved — proceeding to implementation

## Context

RestoSuite is a vanilla JS SPA (esbuild concatenation, not ES module bundling) with a Node/Express + better-sqlite3 backend. We are adding Capacitor (Approach C: config now, `cap add` platforms deferred) and a HACCP label-scan feature for CCP1 meat/fish reception.

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Photo storage | Base64 in SQLite, 800px max JPEG | No ephemeral disk dependency (Render); low-volume scans (~10/day/resto) |
| Gemini OCR | Yes — `/extract` endpoint | Same pattern as ai-scan.js; reduces manual entry errors |
| Capacitor JS bridge | `window.Capacitor?.Plugins?.Camera` runtime detection | esbuild concatenation can't import ES modules; Capacitor injects bridge at runtime in native webview |
| Platform scaffolding | Config only now, `cap add ios/android` deferred | Avoids broken native projects without Xcode/Android Studio configured |

## Architecture

```
Capture (native: window.Capacitor.Plugins.Camera  |  browser: <input type="file">)
  → Client-side canvas resize to 800px max, JPEG q=0.75
  → POST /api/haccp/label-scans/extract  (image_base64)
    → Gemini OCR → {product_name, supplier, batch_number, expiry_date, category}
  → Pre-fill form, user reviews/corrects
  → POST /api/haccp/label-scans  (all fields + photo_data)
    → writeAudit() → SQLite label_scans table
```

## SQLite Table

```sql
CREATE TABLE IF NOT EXISTS label_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  supplier TEXT,
  batch_number TEXT,
  expiry_date TEXT,
  temperature REAL,
  category TEXT,
  photo_data TEXT,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER
)
-- No FK REFERENCES — matches cooling_logs/reheating_logs convention for :memory: test DB compat
```

## Files

| File | Action |
|------|--------|
| `capacitor.config.ts` | Create at root |
| `package.json` (root) | Add `@capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/camera` |
| `server/routes/haccp-label-scans.js` | New — `/extract` + CRUD, multi-tenancy, writeAudit |
| `server/index.js` | Table creation + mount route under `/api/haccp/label-scans` + planGate('essential') |
| `client/js/views/haccp-label-scan.js` | New view — capture, extract, form, list |
| `scripts/build.js` | Add view to JS_FILES concat list |
| `client/js/app.js` | Add nav entry in HACCP > Traçabilité subcategory |
| `client/js/router.js` | Add `/haccp/label-scan` route |
| `.gitignore` | Add `ios/` and `android/` |
| `docs/MOBILE_ICONS.md` | App icon size requirements |
| `server/tests/haccp-label-scans.test.js` | New — CRUD + tenant isolation + validation |

## Scope Boundaries

- No `npx cap add ios` / `npx cap add android` in this session (deferred)
- No S3/cloud storage — base64 in SQLite only
- No camera permissions in Info.plist/AndroidManifest (no native project yet)
- Photo compression done client-side with Canvas API

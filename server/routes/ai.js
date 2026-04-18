// ═══════════════════════════════════════════
// /api/ai/* — Alto AI router (composed of focused sub-routers).
//
// Shared middleware (auth + per-account / per-tenant rate limiting) runs once
// here at the parent; each sub-router only owns its HTTP handlers. Helpers,
// prompts, model selection, and role policy live in ai-core.js.
//
//   /parse-voice, /modify-voice         → ai-voice
//   /suggest-suppliers, /menu-suggestions → ai-suggestions
//   /scan-invoice, /scan-mercuriale, /import-mercuriale → ai-scan
//   /chef, /assistant                    → ai-assistant
//   /execute-action, /reject-action      → ai-actions
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const { requireAuth, aiRateLimit } = require('./ai-core');

const router = Router();

// All AI routes require a valid JWT + respect per-account / per-tenant rate
// limits (PENTEST_REPORT C4.2). Applied at the parent so sub-routers inherit
// these guards without per-file bookkeeping.
router.use(requireAuth);
router.use(aiRateLimit);

router.use(require('./ai-voice'));
router.use(require('./ai-suggestions'));
router.use(require('./ai-scan'));
router.use(require('./ai-assistant'));
router.use(require('./ai-actions'));

module.exports = router;

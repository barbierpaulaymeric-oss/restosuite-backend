'use strict';

/**
 * Auth protection smoke tests.
 * Every protected route must return 401 (not 200/500/403) when no token is given.
 * This catches routes that accidentally lost their requireAuth middleware.
 */

const request = require('supertest');
const app = require('../app');

const PROTECTED_ROUTES = [
  // Core data management
  { method: 'get', path: '/api/ingredients' },
  { method: 'get', path: '/api/suppliers' },
  { method: 'get', path: '/api/recipes' },
  { method: 'get', path: '/api/prices' },
  // HACCP
  { method: 'get', path: '/api/haccp/zones' },
  { method: 'get', path: '/api/haccp/temperatures' },
  { method: 'get', path: '/api/haccp/cleaning' },
  { method: 'get', path: '/api/haccp/traceability' },
  { method: 'get', path: '/api/haccp/cooling' },
  { method: 'get', path: '/api/haccp/reheating' },
  { method: 'get', path: '/api/haccp/fryers' },
  { method: 'get', path: '/api/haccp/non-conformities' },
  { method: 'get', path: '/api/haccp-plan' },
  // Operations
  { method: 'get', path: '/api/stock' },
  { method: 'get', path: '/api/orders' },
  { method: 'get', path: '/api/deliveries' },
  { method: 'get', path: '/api/purchase-orders' },
  // Business
  { method: 'get', path: '/api/crm/customers' },
  { method: 'get', path: '/api/analytics/dashboard' },
  { method: 'get', path: '/api/menu/ingredients/1' }, // auth-protected subroute
  { method: 'get', path: '/api/plans/current' },
  // Safety & compliance
  { method: 'get', path: '/api/training' },
  { method: 'get', path: '/api/pest-control' },
  { method: 'get', path: '/api/maintenance' },
  { method: 'get', path: '/api/waste' },
  { method: 'get', path: '/api/water' },
  { method: 'get', path: '/api/carbon' },
  { method: 'get', path: '/api/variance' },
  { method: 'get', path: '/api/traceability' },
  { method: 'get', path: '/api/corrective-actions' },
  { method: 'get', path: '/api/tiac' },
  { method: 'get', path: '/api/predictions' },
  { method: 'get', path: '/api/sites' },
  { method: 'get', path: '/api/service/config' }, // auth-protected subroute
  { method: 'get', path: '/api/alerts' },
  { method: 'get', path: '/api/integrations' },
  { method: 'get', path: '/api/accounts' },
  // AI (POST)
  { method: 'post', path: '/api/ai/parse-voice' },
  { method: 'post', path: '/api/ai/chef' },
  { method: 'post', path: '/api/ai/assistant' },
];

describe('Auth protection — protected routes return 401 without token', () => {
  test.each(PROTECTED_ROUTES)(
    '$method $path → 401',
    async ({ method, path }) => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    }
  );
});

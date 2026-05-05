'use strict';

// Provider registry for supplier-side external integrations.
// Add a new provider:
//   1. Drop a module under server/lib/integrations/<name>.js exposing the
//      { name, authenticate, fetchMercuriale, postOrder } contract.
//   2. Register it here.

const foodflow = require('./foodflow');

const PROVIDERS = Object.freeze({
  [foodflow.name]: foodflow,
});

function getProvider(name) {
  if (!name) return null;
  return PROVIDERS[String(name).toLowerCase()] || null;
}

function listProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { getProvider, listProviders, PROVIDERS };

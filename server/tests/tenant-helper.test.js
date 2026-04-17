'use strict';

const { requireTenant, tenantId } = require('../lib/tenant');

describe('requireTenant middleware', () => {
  it('calls next when req.user.restaurant_id is present', () => {
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn() };
    requireTenant({ user: { restaurant_id: 1 } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when req.user is absent', () => {
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn() };
    requireTenant({}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when restaurant_id is missing from user', () => {
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn() };
    requireTenant({ user: { id: 5 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tenantId(req)', () => {
  it('returns req.user.restaurant_id', () => {
    expect(tenantId({ user: { restaurant_id: 42 } })).toBe(42);
  });
  it('throws if absent', () => {
    expect(() => tenantId({})).toThrow();
  });
});

'use strict';
// bcrypt work factor. 12 in production (OWASP recommendation). 10 under tests —
// hashing strength is irrelevant to the suite, and cost 12 across the many
// register/login/PIN operations noticeably slowed the in-band run and pushed
// some files past their timeouts. Existing hashes keep their own embedded cost,
// so verification of older cost-10 hashes is unaffected.
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 10 : 12;

module.exports = { BCRYPT_ROUNDS };

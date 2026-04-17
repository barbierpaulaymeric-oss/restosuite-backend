// Runs before each test file (jest setupFiles).
// Must set env vars before any module is required.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'restosuite-dev-secret-2026';
process.env.NODE_ENV = 'test';

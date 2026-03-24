// Test environment variables — use fixed test keys, never real credentials
process.env.MASTER_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.NODE_ENV = 'test';

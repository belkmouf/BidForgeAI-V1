// Jest setup file
// This runs before each test file

// Set up environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";

// Use existing DATABASE_URL or provide a test database URL
// For integration tests, you need a real test database
if (!process.env.DATABASE_URL) {
  console.warn(
    "WARNING: DATABASE_URL not set. Integration tests will be skipped.",
  );
  console.warn(
    "To run integration tests, set DATABASE_URL to a test database.",
  );
  // Set a placeholder to prevent crashes, but tests requiring DB will fail gracefully
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
}

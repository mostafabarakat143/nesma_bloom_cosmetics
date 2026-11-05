const ALLOWED_TEST_DATABASES = new Set(["nesma_bloom_test"]);
const ROUTING_PARAMETERS = new Set([
  "database", "dbname", "host", "hostaddr", "port", "service", "options",
]);

/** Validate before creating a client or allowing destructive test fixtures to run. */
export function assertTestDatabaseUrl(raw: string): void {
  let url: URL;
  let databaseName: string;
  try {
    url = new URL(raw);
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("Refusing test setup: invalid test database URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !ALLOWED_TEST_DATABASES.has(databaseName) ||
    [...url.searchParams.keys()].some((key) => ROUTING_PARAMETERS.has(key.toLowerCase()))
  ) {
    // Never include credentials or the supplied URL in this error.
    throw new Error("Refusing test setup: use the dedicated nesma_bloom_test database without routing overrides.");
  }
}

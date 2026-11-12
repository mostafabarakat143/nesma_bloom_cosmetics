const ALLOWED_TEST_DATABASES = new Set(["nesma_bloom_test"]);
const ROUTING_PARAMETERS = new Set([
  "database", "dbname", "host", "hostaddr", "port", "service", "options",
]);

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

    throw new Error("Refusing test setup: use the dedicated nesma_bloom_test database without routing overrides.");
  }
}

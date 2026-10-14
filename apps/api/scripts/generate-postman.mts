/**
 * Build a Postman Collection v2.1 from OpenAPI + embedded examples.
 * Edit EXAMPLES below, then run: pnpm docs:postman
 * Regenerating preserves examples because they live in this script.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openApiDocument } from "../src/docs/openapi.js";

type Header = { key: string; value: string; description?: string };
type QueryParam = {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
};
type SavedResponse = {
  name: string;
  status: string;
  code: number;
  header: Array<{ key: string; value: string }>;
  body: string;
  _postman_previewlanguage: string;
};

type CsrfMode =
  /** No CSRF header (safe GETs). */
  | "none"
  /**
   * Register/login bootstrap: if nb_csrf cookie exists, send matching header;
   * if not, omit the header (empty {{csrfToken}} must never be sent).
   */
  | "bootstrap"
  /** Authenticated mutations: send x-csrf-token synced from nb_csrf. */
  | "required";

type ExampleDef = {
  name?: string;
  description: string;
  /** @deprecated use csrfMode */
  csrf?: boolean;
  csrfMode?: CsrfMode;
  body?: unknown;
  query?: QueryParam[];
  successExample?: { code: number; status: string; body: unknown };
  errorExample?: { code: number; status: string; body: unknown };
};

/**
 * Postman CSRF helpers (client-side only; backend keeps full double-submit).
 *
 * Register/login: clear stale nb_csrf for the request baseUrl and strip CSRF headers
 * so the backend "no cookie yet" path applies. Requires Domains Allowlist for baseUrl.
 * Other mutations: upsert x-csrf-token from the nb_csrf cookie (concrete value).
 * Auth Tests: capture Set-Cookie nb_csrf into collection csrfToken.
 */
const POSTMAN_CSRF_HELPERS = `
function stripCsrfHeaders() {
  ['x-csrf-token', 'X-CSRF-Token', 'X-CSRF-TOKEN'].forEach(function (key) {
    pm.request.headers.remove(key);
  });
}

function requestUrlString() {
  try {
    return pm.variables.replaceIn(pm.request.url.toString());
  } catch (e) {
    return pm.request.url.toString();
  }
}

function baseOrigin() {
  try {
    return new URL(requestUrlString()).origin;
  } catch (e) {
    var fromVar = pm.collectionVariables.get('baseUrl');
    return fromVar ? String(fromVar).replace(/\\/$/, '') : '';
  }
}

function requestPath() {
  try {
    return new URL(requestUrlString()).pathname;
  } catch (e) {
    return pm.request.url.getPath ? pm.request.url.getPath() : '';
  }
}

function isAuthBootstrapPath(pathname) {
  return /\\/api\\/v1\\/auth\\/(register|login)\\/?$/.test(pathname || '');
}

function unsetNbCsrf(jar, origin) {
  return new Promise(function (resolve) {
    if (!origin) return resolve();
    try {
      jar.unset(origin, 'nb_csrf', function () { resolve(); });
    } catch (e) {
      resolve();
    }
  });
}

function getNbCsrf(jar, origin) {
  return new Promise(function (resolve) {
    if (!origin) return resolve(null);
    try {
      jar.get(origin, 'nb_csrf', function (err, value) {
        resolve(!err && value ? String(value) : null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}
`.trim();

/** Single collection pre-request: bootstrap clears nb_csrf; mutations sync header. */
const COLLECTION_PREREQUEST = `
${POSTMAN_CSRF_HELPERS}

return (async function () {
  var jar = pm.cookies.jar();
  var origin = baseOrigin();
  var pathname = requestPath();
  var method = String(pm.request.method || '').toUpperCase();

  if (isAuthBootstrapPath(pathname)) {
    await unsetNbCsrf(jar, origin);
    pm.collectionVariables.set('csrfToken', '');
    stripCsrfHeaders();
    return;
  }

  var csrf = await getNbCsrf(jar, origin);
  if (!csrf) {
    try {
      var direct = pm.cookies.get('nb_csrf');
      if (direct) csrf = String(direct);
    } catch (e) {}
  }
  if (!csrf) {
    var fromVar = pm.collectionVariables.get('csrfToken');
    if (fromVar && String(fromVar).trim()) csrf = String(fromVar).trim();
  }

  if (csrf) {
    pm.collectionVariables.set('csrfToken', csrf);
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      pm.request.headers.upsert({ key: 'x-csrf-token', value: csrf });
    }
  } else {
    pm.collectionVariables.set('csrfToken', '');
    var existing = pm.request.headers.get('x-csrf-token');
    if (existing === null || existing === undefined || !String(existing).trim() || String(existing).indexOf('{{') !== -1) {
      stripCsrfHeaders();
    }
  }
})();
`.trim();

/** After register/login, sync csrfToken from Set-Cookie (no Environment mutation). */
const AUTH_SUCCESS_TEST = `
(function () {
  var headers = pm.response.headers.all();
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i].key).toLowerCase() !== 'set-cookie') continue;
    var raw = String(headers[i].value || '');
    var match = raw.match(/^nb_csrf=([^;]+)/i);
    if (match && match[1]) {
      pm.collectionVariables.set('csrfToken', decodeURIComponent(match[1]));
      return;
    }
  }
  try {
    var cookie = pm.cookies.get('nb_csrf');
    if (cookie) pm.collectionVariables.set('csrfToken', cookie);
  } catch (e) {}
})();
`.trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../docs/postman");
const outFile = path.join(outDir, "Nesma-Bloom-API.postman_collection.json");

const SAMPLE_UUID = {
  categoryId: "11111111-1111-4111-8111-111111111111",
  subcategoryId: "22222222-2222-4222-8222-222222222222",
  productId: "33333333-3333-4333-8333-333333333333",
  imageId: "44444444-4444-4444-8444-444444444444",
  orderId: "55555555-5555-4555-8555-555555555555",
  userId: "66666666-6666-4666-8666-666666666666",
};

/** Key: `${METHOD} ${openapiPath}` e.g. `POST /api/v1/orders` */
const EXAMPLES: Record<string, ExampleDef> = {
  "GET /health": {
    description:
      "Liveness probe. No authentication.\n\nPublic — no cookies or CSRF.",
    successExample: {
      code: 200,
      status: "OK",
      body: { status: "ok" },
    },
  },

  "POST /api/v1/auth/register": {
    name: "Register CUSTOMER",
    description: [
      "Creates a CUSTOMER account and sets cookies:",
      "- `nb_access` / `nb_refresh` (HttpOnly)",
      "- `nb_csrf` (readable; used for double-submit CSRF on later mutations)",
      "",
      "**Role:** Public (always registers as CUSTOMER — cannot self-register as ADMIN).",
      "**Cookies:** Enable cookie jar. Add `{{baseUrl}}` origin to Cookies → Domains Allowlist.",
      "**CSRF:** Origin required. Collection pre-request clears stale `nb_csrf` for `baseUrl` and strips",
      "`x-csrf-token` (backend only requires double-submit when `nb_csrf` is present).",
      "Tests capture the new `nb_csrf` into `csrfToken`.",
      "",
      "Email uses `{{$timestamp}}` for uniqueness. Re-run with the same email to see 409.",
    ].join("\n"),
    csrfMode: "bootstrap",
    body: {
      email: "customer-{{$timestamp}}@example.com",
      password: "Password123!",
      firstName: "Nesma",
      lastName: "Bloom",
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          user: {
            id: SAMPLE_UUID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt: "2026-10-14T18:00:00.000Z",
            updatedAt: "2026-10-14T18:00:00.000Z",
            profile: {
              firstName: "Nesma",
              lastName: "Bloom",
              phone: null,
              avatarUrl: null,
            },
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message:
          "An account with this email already exists. Please log in.",
        code: "CONFLICT",
      },
    },
  },

  "POST /api/v1/auth/login": {
    name: "Login",
    description: [
      "Logs in CUSTOMER or ADMIN. Sets session cookies.",
      "",
      "**Role:** Public.",
      "**Cookies:** Cookie jar + Domains Allowlist for `{{baseUrl}}`.",
      "**CSRF:** Same as register — clear stale `nb_csrf` / strip CSRF headers; capture new token after success.",
      "",
      "For ADMIN catalog mutations, log in with an existing ADMIN account (registration cannot create ADMIN).",
      "Replace the email with your registered customer (or ADMIN) address.",
    ].join("\n"),
    csrfMode: "bootstrap",
    body: {
      email: "customer-demo@example.com",
      password: "Password123!",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          user: {
            id: SAMPLE_UUID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
            status: "ACTIVE",
          },
        },
      },
    },
    errorExample: {
      code: 401,
      status: "Unauthorized",
      body: {
        status: "error",
        message: "Invalid email or password",
        code: "UNAUTHORIZED",
      },
    },
  },

  "POST /api/v1/auth/refresh": {
    name: "Refresh session",
    description: [
      "Rotates the refresh cookie and issues a new access cookie.",
      "",
      "**Auth:** Requires `nb_refresh` cookie (cookie jar).",
      "**CSRF:** Send Origin + `x-csrf-token: {{csrfToken}}` after login.",
      "Do not store refresh tokens in variables.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          user: {
            id: SAMPLE_UUID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
          },
        },
      },
    },
    errorExample: {
      code: 401,
      status: "Unauthorized",
      body: {
        status: "error",
        message: "Authentication required",
        code: "UNAUTHORIZED",
      },
    },
  },

  "POST /api/v1/auth/logout": {
    name: "Logout",
    description: [
      "Revokes the current session and clears auth cookies.",
      "",
      "**Auth:** Authenticated (access cookie).",
      "**CSRF:** Origin + `x-csrf-token: {{csrfToken}}`.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: { status: "success", data: { ok: true } },
    },
  },

  "GET /api/v1/auth/me": {
    name: "Current user (me)",
    description: [
      "Returns the authenticated user. Never includes passwordHash.",
      "",
      "**Auth:** CUSTOMER or ADMIN cookie session.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          user: {
            id: SAMPLE_UUID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
            status: "ACTIVE",
          },
        },
      },
    },
    errorExample: {
      code: 401,
      status: "Unauthorized",
      body: {
        status: "error",
        message: "Authentication required",
        code: "UNAUTHORIZED",
      },
    },
  },

  "GET /api/v1/users/me/profile": {
    name: "Get own profile",
    description: "**Auth:** CUSTOMER or ADMIN (own profile only).",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          profile: {
            firstName: "Nesma",
            lastName: "Bloom",
            phone: null,
            avatarUrl: null,
          },
        },
      },
    },
  },

  "PATCH /api/v1/users/me/profile": {
    name: "Update own profile",
    description: [
      "Partial profile update. At least one field required.",
      "",
      "**Auth:** Authenticated.",
      "**CSRF:** Origin + `x-csrf-token: {{csrfToken}}`.",
    ].join("\n"),
    body: {
      firstName: "Nesma",
      lastName: "Bloom",
      phone: "+201000000000",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          profile: {
            firstName: "Nesma",
            lastName: "Bloom",
            phone: "+201000000000",
            avatarUrl: null,
          },
        },
      },
    },
    errorExample: {
      code: 400,
      status: "Bad Request",
      body: {
        status: "error",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: [
          { path: "(root)", message: "At least one profile field is required" },
        ],
      },
    },
  },

  "GET /api/v1/categories": {
    name: "List categories",
    description: [
      "Public list defaults to ACTIVE. `status=ALL` or `ARCHIVED` requires ADMIN.",
      "",
      "**Auth:** Optional for ACTIVE; ADMIN for archived/all filters.",
    ].join("\n"),
    query: [
      { key: "page", value: "1" },
      { key: "pageSize", value: "20" },
      { key: "search", value: "skin", disabled: true },
      { key: "status", value: "ACTIVE" },
      { key: "sortBy", value: "name" },
      { key: "sortOrder", value: "asc" },
    ],
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          items: [
            {
              id: SAMPLE_UUID.categoryId,
              name: "Skincare",
              slug: "skincare",
              status: "ACTIVE",
            },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      },
    },
  },

  "POST /api/v1/categories": {
    name: "Create category",
    description: [
      "Creates a catalog category. Slug optional (generated from name).",
      "",
      "**Auth:** ADMIN + cookies.",
      "**CSRF:** Origin + `x-csrf-token: {{csrfToken}}`.",
      "",
      "After success, copy `data.category.id` into `{{categoryId}}`.",
    ].join("\n"),
    body: {
      name: "Skincare Demo",
      slug: "skincare-demo",
      description: "Face and body care",
      status: "ACTIVE",
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          category: {
            id: SAMPLE_UUID.categoryId,
            name: "Skincare Demo",
            slug: "skincare-demo",
            description: "Face and body care",
            status: "ACTIVE",
            createdAt: "2026-10-14T18:00:00.000Z",
            updatedAt: "2026-10-14T18:00:00.000Z",
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Category slug already exists",
        code: "CONFLICT",
      },
    },
  },

  "GET /api/v1/categories/{id}": {
    name: "Get category by ID",
    description:
      "Public if ACTIVE; ADMIN can view ARCHIVED. Uses `{{categoryId}}`.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          category: {
            id: SAMPLE_UUID.categoryId,
            name: "Skincare Demo",
            slug: "skincare-demo",
            status: "ACTIVE",
          },
        },
      },
    },
    errorExample: {
      code: 404,
      status: "Not Found",
      body: {
        status: "error",
        message: "Category not found",
        code: "NOT_FOUND",
      },
    },
  },

  "PATCH /api/v1/categories/{id}": {
    name: "Update category",
    description:
      "**Auth:** ADMIN. **CSRF** required. Name updates do not auto-change slug.",
    body: {
      name: "Skincare Updated",
      description: "Updated description",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          category: {
            id: SAMPLE_UUID.categoryId,
            name: "Skincare Updated",
            slug: "skincare-demo",
            status: "ACTIVE",
          },
        },
      },
    },
  },

  "DELETE /api/v1/categories/{id}": {
    name: "Archive category",
    description:
      "Soft-delete (status ARCHIVED). **Auth:** ADMIN. **CSRF** required. Idempotent.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          category: {
            id: SAMPLE_UUID.categoryId,
            status: "ARCHIVED",
          },
        },
      },
    },
  },

  "GET /api/v1/subcategories": {
    name: "List subcategories",
    description:
      "Public ACTIVE + ACTIVE parent. Filter by `categoryId`. ADMIN for status ALL/ARCHIVED.",
    query: [
      { key: "page", value: "1" },
      { key: "pageSize", value: "20" },
      { key: "categoryId", value: "{{categoryId}}" },
      { key: "status", value: "ACTIVE" },
      { key: "sortBy", value: "name" },
      { key: "sortOrder", value: "asc" },
    ],
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          items: [
            {
              id: SAMPLE_UUID.subcategoryId,
              name: "Serums",
              slug: "serums",
              categoryId: SAMPLE_UUID.categoryId,
              status: "ACTIVE",
            },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      },
    },
  },

  "POST /api/v1/subcategories": {
    name: "Create subcategory",
    description: [
      "**Auth:** ADMIN. **CSRF** required.",
      "Set `categoryId` to `{{categoryId}}` from a created category.",
      "Copy response id into `{{subcategoryId}}`.",
    ].join("\n"),
    body: {
      name: "Serums Demo",
      categoryId: "{{categoryId}}",
      slug: "serums-demo",
      description: "Concentrated treatments",
      status: "ACTIVE",
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          subcategory: {
            id: SAMPLE_UUID.subcategoryId,
            name: "Serums Demo",
            slug: "serums-demo",
            categoryId: SAMPLE_UUID.categoryId,
            status: "ACTIVE",
            category: {
              id: SAMPLE_UUID.categoryId,
              name: "Skincare Demo",
              slug: "skincare-demo",
              status: "ACTIVE",
            },
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Cannot place an ACTIVE subcategory under an archived category",
        code: "CONFLICT",
      },
    },
  },

  "GET /api/v1/subcategories/{id}": {
    name: "Get subcategory by ID",
    description: "Uses `{{subcategoryId}}`. Public if visible; else 404.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          subcategory: {
            id: SAMPLE_UUID.subcategoryId,
            name: "Serums Demo",
            slug: "serums-demo",
            status: "ACTIVE",
          },
        },
      },
    },
  },

  "PATCH /api/v1/subcategories/{id}": {
    name: "Update subcategory",
    description: "**Auth:** ADMIN. **CSRF** required.",
    body: {
      name: "Serums Updated",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          subcategory: {
            id: SAMPLE_UUID.subcategoryId,
            name: "Serums Updated",
            slug: "serums-demo",
            status: "ACTIVE",
          },
        },
      },
    },
  },

  "DELETE /api/v1/subcategories/{id}": {
    name: "Archive subcategory",
    description: "**Auth:** ADMIN. Soft archive. **CSRF** required.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          subcategory: {
            id: SAMPLE_UUID.subcategoryId,
            status: "ARCHIVED",
          },
        },
      },
    },
  },

  "GET /api/v1/products": {
    name: "List products",
    description: [
      "Public: ACTIVE + available + ACTIVE parents. Out-of-stock still listed (`inStock: false`).",
      "ADMIN may use `status` / `availability` filters beyond defaults.",
    ].join("\n"),
    query: [
      { key: "page", value: "1" },
      { key: "pageSize", value: "20" },
      { key: "search", value: "serum", disabled: true },
      { key: "categoryId", value: "{{categoryId}}", disabled: true },
      { key: "subcategoryId", value: "{{subcategoryId}}", disabled: true },
      { key: "minPriceMinor", value: "0", disabled: true },
      { key: "maxPriceMinor", value: "100000", disabled: true },
      { key: "availability", value: "AVAILABLE" },
      { key: "status", value: "ACTIVE" },
      { key: "sortBy", value: "createdAt" },
      { key: "sortOrder", value: "desc" },
    ],
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          items: [
            {
              id: SAMPLE_UUID.productId,
              name: "Rose Serum",
              sku: "SKU-ROSE-001",
              priceMinor: 25000,
              currency: "EGP",
              stockQty: 10,
              inStock: true,
              status: "ACTIVE",
            },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      },
    },
  },

  "POST /api/v1/products": {
    name: "Create product",
    description: [
      "**Auth:** ADMIN. **CSRF** required.",
      "Set `subcategoryId` to `{{subcategoryId}}`. SKU unique; use a unique value each run.",
      "Prices are integer EGP piastres (`25000` = 250.00 EGP).",
      "Copy response id into `{{productId}}`.",
    ].join("\n"),
    body: {
      name: "Rose Serum Demo",
      subcategoryId: "{{subcategoryId}}",
      sku: "SKU-ROSE-DEMO-001",
      priceMinor: 25000,
      stockQty: 10,
      slug: "rose-serum-demo",
      description: "Hydrating rose serum",
      isAvailable: true,
      status: "ACTIVE",
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            name: "Rose Serum Demo",
            slug: "rose-serum-demo",
            sku: "SKU-ROSE-DEMO-001",
            priceMinor: 25000,
            currency: "EGP",
            stockQty: 10,
            isAvailable: true,
            inStock: true,
            status: "ACTIVE",
            images: [],
            subcategory: {
              id: SAMPLE_UUID.subcategoryId,
              name: "Serums Demo",
              slug: "serums-demo",
              status: "ACTIVE",
            },
            category: {
              id: SAMPLE_UUID.categoryId,
              name: "Skincare Demo",
              slug: "skincare-demo",
              status: "ACTIVE",
            },
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Product SKU already exists",
        code: "CONFLICT",
      },
    },
  },

  "GET /api/v1/products/{id}": {
    name: "Get product by ID",
    description: "Uses `{{productId}}`. Public if storefront-visible.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            name: "Rose Serum Demo",
            sku: "SKU-ROSE-DEMO-001",
            priceMinor: 25000,
            currency: "EGP",
            stockQty: 10,
            inStock: true,
            images: [],
          },
        },
      },
    },
  },

  "PATCH /api/v1/products/{id}": {
    name: "Update product",
    description: "**Auth:** ADMIN. **CSRF** required. Name does not auto-change slug.",
    body: {
      stockQty: 8,
      description: "Updated product description",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            stockQty: 8,
            inStock: true,
          },
        },
      },
    },
  },

  "DELETE /api/v1/products/{id}": {
    name: "Archive product",
    description: "**Auth:** ADMIN. Soft archive. **CSRF** required.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            status: "ARCHIVED",
          },
        },
      },
    },
  },

  "POST /api/v1/products/{id}/images": {
    name: "Add product image",
    description: [
      "Adds an image URL (no file upload). **Auth:** ADMIN. **CSRF** required.",
      "Uses `{{productId}}`. Copy image id into `{{imageId}}`.",
    ].join("\n"),
    body: {
      url: "https://cdn.example.com/products/rose-serum.jpg",
      altText: "Rose serum bottle",
      sortOrder: 0,
      isPrimary: true,
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            images: [
              {
                id: SAMPLE_UUID.imageId,
                url: "https://cdn.example.com/products/rose-serum.jpg",
                altText: "Rose serum bottle",
                sortOrder: 0,
                isPrimary: true,
              },
            ],
          },
        },
      },
    },
    errorExample: {
      code: 400,
      status: "Bad Request",
      body: {
        status: "error",
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: [
          {
            path: "url",
            message: "Image URL must be http(s) without credentials",
          },
        ],
      },
    },
  },

  "PATCH /api/v1/products/{id}/images/{imageId}": {
    name: "Update product image",
    description:
      "**Auth:** ADMIN. **CSRF** required. Paths use `{{productId}}` and `{{imageId}}`.",
    body: {
      altText: "Updated alt text",
      isPrimary: true,
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            images: [
              {
                id: SAMPLE_UUID.imageId,
                altText: "Updated alt text",
                isPrimary: true,
              },
            ],
          },
        },
      },
    },
  },

  "DELETE /api/v1/products/{id}/images/{imageId}": {
    name: "Delete product image",
    description:
      "**Auth:** ADMIN. Hard-deletes image; promotes next primary if needed. **CSRF** required.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_UUID.productId,
            images: [],
          },
        },
      },
    },
  },

  "GET /api/v1/orders": {
    name: "List all orders (ADMIN)",
    description: "**Auth:** ADMIN only.",
    query: [
      { key: "page", value: "1" },
      { key: "pageSize", value: "20" },
      { key: "status", value: "ALL" },
      { key: "sortOrder", value: "desc" },
      { key: "userId", value: "{{userId}}", disabled: true },
    ],
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          items: [
            {
              id: SAMPLE_UUID.orderId,
              status: "PENDING",
              totalMinor: 50000,
              currency: "EGP",
            },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      },
    },
    errorExample: {
      code: 403,
      status: "Forbidden",
      body: {
        status: "error",
        message: "Insufficient permissions",
        code: "FORBIDDEN",
      },
    },
  },

  "POST /api/v1/orders": {
    name: "Create order (CUSTOMER)",
    description: [
      "Places an order. Stock is deducted; prices come from the database.",
      "",
      "**Auth:** CUSTOMER only (ADMIN gets 403).",
      "**CSRF:** Origin + `x-csrf-token: {{csrfToken}}`.",
      "**Idempotency-Key:** Required. Use `{{idempotencyKey}}`.",
      "  - First success → HTTP 201",
      "  - Same key + same body → HTTP 200 (no second stock deduction)",
      "  - Same key + different body → HTTP 409",
      "",
      "Set `productId` to `{{productId}}`. Copy order id into `{{orderId}}`.",
      "Generate a new idempotency key (or change `idempotencyKey`) for a fresh order.",
    ].join("\n"),
    body: {
      items: [{ productId: "{{productId}}", quantity: 2 }],
    },
    successExample: {
      code: 201,
      status: "Created",
      body: {
        status: "success",
        data: {
          order: {
            id: SAMPLE_UUID.orderId,
            userId: SAMPLE_UUID.userId,
            status: "PENDING",
            totalMinor: 50000,
            currency: "EGP",
            items: [
              {
                productId: SAMPLE_UUID.productId,
                productNameSnapshot: "Rose Serum Demo",
                productSkuSnapshot: "SKU-ROSE-DEMO-001",
                unitPriceMinor: 25000,
                quantity: 2,
                lineTotalMinor: 50000,
              },
            ],
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Insufficient stock for one or more products",
        code: "CONFLICT",
      },
    },
  },

  "GET /api/v1/orders/my": {
    name: "List my orders",
    description: "**Auth:** Authenticated (own orders only).",
    query: [
      { key: "page", value: "1" },
      { key: "pageSize", value: "20" },
      { key: "status", value: "ALL" },
      { key: "sortOrder", value: "desc" },
    ],
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          items: [
            {
              id: SAMPLE_UUID.orderId,
              status: "PENDING",
              totalMinor: 50000,
              currency: "EGP",
            },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        },
      },
    },
  },

  "GET /api/v1/orders/{id}": {
    name: "Get order by ID",
    description:
      "Owner or ADMIN. Others get 404. Uses `{{orderId}}`.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          order: {
            id: SAMPLE_UUID.orderId,
            status: "PENDING",
            totalMinor: 50000,
            currency: "EGP",
            items: [],
          },
        },
      },
    },
    errorExample: {
      code: 404,
      status: "Not Found",
      body: {
        status: "error",
        message: "Order not found",
        code: "NOT_FOUND",
      },
    },
  },

  "POST /api/v1/orders/{id}/cancel": {
    name: "Cancel order",
    description: [
      "CUSTOMER: PENDING only. ADMIN: PENDING or CONFIRMED. Restocks once.",
      "**Auth** + **CSRF** required. Uses `{{orderId}}`.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          order: {
            id: SAMPLE_UUID.orderId,
            status: "CANCELLED",
            totalMinor: 50000,
            currency: "EGP",
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Order cannot be cancelled in its current status",
        code: "CONFLICT",
      },
    },
  },

  "PATCH /api/v1/orders/{id}/status": {
    name: "Update order status (ADMIN)",
    description: [
      "ADMIN only: PENDING→CONFIRMED or CONFIRMED→FULFILLED (no skip).",
      "**CSRF** required. Uses `{{orderId}}`.",
    ].join("\n"),
    body: {
      status: "CONFIRMED",
    },
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          order: {
            id: SAMPLE_UUID.orderId,
            status: "CONFIRMED",
          },
        },
      },
    },
    errorExample: {
      code: 409,
      status: "Conflict",
      body: {
        status: "error",
        message: "Invalid order status transition",
        code: "CONFLICT",
      },
    },
  },
};

const PATH_VAR_MAP: Record<string, string> = {
  "{id}": "id",
  "{imageId}": "imageId",
};

function resolvePathVars(
  routePath: string,
): { pathSegments: string[]; rawPath: string } {
  let raw = routePath;
  // Prefer semantic collection variables for common resource ids
  raw = raw
    .replace("/api/v1/categories/{id}", "/api/v1/categories/{{categoryId}}")
    .replace(
      "/api/v1/subcategories/{id}",
      "/api/v1/subcategories/{{subcategoryId}}",
    )
    .replace("/api/v1/products/{id}", "/api/v1/products/{{productId}}")
    .replace(
      "/api/v1/products/{{productId}}/images/{imageId}",
      "/api/v1/products/{{productId}}/images/{{imageId}}",
    )
    .replace("/api/v1/orders/{id}", "/api/v1/orders/{{orderId}}");

  // Any leftover OpenAPI params
  for (const [token, name] of Object.entries(PATH_VAR_MAP)) {
    raw = raw.replaceAll(token, `{{${name}}}`);
  }

  const pathSegments = raw.replace(/^\//, "").split("/");
  return { pathSegments, rawPath: raw };
}

function resolveCsrfMode(
  method: string,
  example: ExampleDef | undefined,
): CsrfMode {
  if (example?.csrfMode) {
    return example.csrfMode;
  }
  if (example?.csrf === false) {
    return "bootstrap";
  }
  if (method === "get" || method === "head" || method === "options") {
    return "none";
  }
  return "required";
}

function buildHeaders(
  method: string,
  routePath: string,
  example: ExampleDef | undefined,
): Header[] {
  const headers: Header[] = [];
  const needsMutationHeaders = method !== "get";
  const csrfMode = resolveCsrfMode(method, example);

  if (needsMutationHeaders) {
    headers.push({
      key: "Origin",
      value: "{{origin}}",
      description: "Must match CORS_ORIGIN (e.g. http://localhost:3000)",
    });
    // Bootstrap: header added/removed by pre-request script (never send empty).
    // Required: header present; collection pre-request syncs value from cookie.
    if (csrfMode === "required") {
      headers.push({
        key: "x-csrf-token",
        value: "{{csrfToken}}",
        description:
          "Must equal nb_csrf. Synced automatically from the cookie jar.",
      });
    }
    if (example?.body !== undefined) {
      headers.push({ key: "Content-Type", value: "application/json" });
    }
  }

  if (routePath === "/api/v1/orders" && method === "post") {
    headers.push({
      key: "Idempotency-Key",
      value: "{{idempotencyKey}}",
      description:
        "Required. Reuse the same value to replay; change it for a new order.",
    });
  }

  return headers;
}

function toSavedResponse(
  example: { code: number; status: string; body: unknown },
  name: string,
): SavedResponse {
  return {
    name,
    status: example.status,
    code: example.code,
    header: [{ key: "Content-Type", value: "application/json" }],
    body: JSON.stringify(example.body, null, 2),
    _postman_previewlanguage: "json",
  };
}

type PostmanEvent = {
  listen: "prerequest" | "test";
  script: { type: string; exec: string[] };
};

type PostmanItem = {
  name: string;
  event?: PostmanEvent[];
  request: {
    method: string;
    header: Header[];
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: QueryParam[];
    };
    body?: { mode: string; raw: string; options?: { raw: { language: string } } };
    description?: string;
  };
  response?: SavedResponse[];
};

function scriptEvent(
  listen: "prerequest" | "test",
  source: string,
): PostmanEvent {
  return {
    listen,
    script: {
      type: "text/javascript",
      exec: source.split("\n"),
    },
  };
}

const folders = new Map<string, PostmanItem[]>();
let missingExamples = 0;

for (const [routePath, methods] of Object.entries(openApiDocument.paths)) {
  for (const [method, operation] of Object.entries(
    methods as unknown as Record<
      string,
      {
        tags?: string[];
        summary?: string;
        description?: string;
        requestBody?: unknown;
      }
    >,
  )) {
    if (!["get", "post", "patch", "put", "delete"].includes(method)) continue;

    const key = `${method.toUpperCase()} ${routePath}`;
    const example = EXAMPLES[key];
    if (!example) {
      missingExamples += 1;
      console.warn(`No EXAMPLES entry for ${key}`);
    }

    const tag = operation.tags?.[0] ?? "API";
    const { pathSegments, rawPath } = resolvePathVars(routePath);
    const queryForUrl = example?.query;
    const csrfMode = resolveCsrfMode(method, example);

    const rawUrl =
      queryForUrl && queryForUrl.length > 0
        ? `{{baseUrl}}${rawPath}?${queryForUrl
            .filter((q) => !q.disabled)
            .map((q) => `${q.key}=${q.value}`)
            .join("&")}`
        : `{{baseUrl}}${rawPath}`;

    const events: PostmanEvent[] = [];
    if (csrfMode === "bootstrap") {
      // Collection pre-request clears stale nb_csrf; Tests capture the new token.
      events.push(scriptEvent("test", AUTH_SUCCESS_TEST));
    }

    const item: PostmanItem = {
      name: example?.name ?? operation.summary ?? key,
      ...(events.length > 0 ? { event: events } : {}),
      request: {
        method: method.toUpperCase(),
        header: buildHeaders(method, routePath, example),
        url: {
          raw: rawUrl,
          host: ["{{baseUrl}}"],
          path: pathSegments,
          ...(queryForUrl && queryForUrl.length > 0
            ? { query: queryForUrl }
            : {}),
        },
        description: [
          example?.description ??
            operation.description ??
            operation.summary ??
            "",
          "",
          "Tips: Enable cookie jar. csrfToken syncs from nb_csrf automatically.",
          "Do not paste access/refresh tokens into variables.",
        ].join("\n"),
      },
      response: [],
    };

    if (example?.body !== undefined) {
      item.request.body = {
        mode: "raw",
        raw: JSON.stringify(example.body, null, 2),
        options: { raw: { language: "json" } },
      };
    } else if (operation.requestBody) {
      item.request.body = {
        mode: "raw",
        raw: "{\n}\n",
        options: { raw: { language: "json" } },
      };
    }

    if (example?.successExample) {
      item.response!.push(
        toSavedResponse(
          example.successExample,
          `Success ${example.successExample.code}`,
        ),
      );
    }
    if (example?.errorExample) {
      item.response!.push(
        toSavedResponse(
          example.errorExample,
          `Error ${example.errorExample.code}`,
        ),
      );
    }

    const list = folders.get(tag) ?? [];
    list.push(item);
    folders.set(tag, list);
  }
}

const collection = {
  info: {
    name: "Nesma Bloom Cosmetics API",
    description: [
      "Ready-to-use examples for local manual testing.",
      "",
      "## Postman Desktop setup",
      "1. Delete any old copy of this collection (do not merge).",
      "2. Cookies → Domains Allowlist → add your API origin (e.g. `http://localhost:4000`).",
      "3. If register/login return CSRF 403: Cookies → delete `nb_csrf` for that host, then retry.",
      "4. Import `apps/api/docs/postman/Nesma-Bloom-API.postman_collection.json`.",
      "5. Collection variables: `baseUrl=http://localhost:4000`, `origin=http://localhost:3000`.",
      "6. Prefer leaving Environment `csrfToken` unset (collection variable is enough).",
      "",
      "## Quick start",
      "1. Register or Login — collection pre-request clears stale `nb_csrf`; Tests capture the new token.",
      "2. ADMIN catalog writes: login as an existing ADMIN (register cannot create ADMIN).",
      "3. Create Category → Subcategory → Product → Image; save IDs into variables.",
      "4. CUSTOMER → Create Order (idempotencyKey) → Get/Cancel.",
      "",
      "## CSRF notes",
      "- Backend: Origin required; double-submit (`nb_csrf` == `x-csrf-token`) when the cookie exists.",
      "- Register/Login (Postman): clear only `nb_csrf` for `baseUrl` + strip CSRF headers (first-visit path).",
      "- Other mutations: pre-request upserts a concrete `x-csrf-token` matching `nb_csrf`.",
      "",
      "Regenerate: pnpm --filter @cosmetics/api docs:postman",
      "Source: apps/api/scripts/generate-postman.mts",
    ].join("\n"),
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [scriptEvent("prerequest", COLLECTION_PREREQUEST)],
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "origin", value: "http://localhost:3000" },
    { key: "csrfToken", value: "" },
    { key: "categoryId", value: "" },
    { key: "subcategoryId", value: "" },
    { key: "productId", value: "" },
    { key: "imageId", value: "" },
    { key: "orderId", value: "" },
    { key: "userId", value: "" },
    {
      key: "idempotencyKey",
      value: "demo-order-key-001",
      description: "Change for each new order; reuse to test idempotent replay",
    },
  ],
  item: [...folders.entries()].map(([name, item]) => ({ name, item })),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

const requestCount = [...folders.values()].reduce((n, i) => n + i.length, 0);
console.log(`Wrote ${outFile}`);
console.log(`Folders: ${folders.size}, requests: ${requestCount}`);
if (missingExamples > 0) {
  console.warn(`Warning: ${missingExamples} OpenAPI operations lack EXAMPLES entries`);
}

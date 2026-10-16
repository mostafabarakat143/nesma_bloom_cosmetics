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

type ExampleDef = {
  name?: string;
  description: string;
  /** Capture data.token from Login/Register into collection {{token}}. */
  captureToken?: boolean;
  /** Omit Authorization header (public endpoints). */
  public?: boolean;
  body?: unknown;
  query?: QueryParam[];
  successExample?: { code: number; status: string; body: unknown };
  errorExample?: { code: number; status: string; body: unknown };
};

/** Capture Bearer JWT from register/login into collection variable `token`. Never hardcode real JWTs. */
const AUTH_CAPTURE_TOKEN_TEST = `
(function () {
  try {
    var json = pm.response.json();
    var token = json && json.data && json.data.token;
    if (typeof token === 'string' && token.length > 0) {
      pm.collectionVariables.set('token', token);
    }
  } catch (e) {}
})();
`.trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../docs/postman");
const outFile = path.join(outDir, "Nesma-Bloom-API.postman_collection.json");

const SAMPLE_ID = {
  categoryId: 1,
  subcategoryId: 1,
  productId: 1,
  imageId: 1,
  orderId: 1,
  userId: 1,
};

/** Key: `${METHOD} ${openapiPath}` e.g. `POST /api/v1/orders` */
const EXAMPLES: Record<string, ExampleDef> = {
  "GET /health": {
    description: "Liveness probe. No authentication.",
    public: true,
    successExample: {
      code: 200,
      status: "OK",
      body: { status: "ok" },
    },
  },

  "POST /api/v1/auth/register": {
    name: "Register CUSTOMER",
    description: [
      "Creates a CUSTOMER account and returns a Bearer JWT in `data.token`.",
      "",
      "**Role:** Public (always registers as CUSTOMER — cannot self-register as ADMIN).",
      "**Auth:** None. Tests script captures `data.token` into collection variable `{{token}}`.",
      "",
      "Email uses `{{$timestamp}}` for uniqueness. Re-run with the same email to see 409.",
    ].join("\n"),
    public: true,
    captureToken: true,
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
            id: SAMPLE_ID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
            status: "ACTIVE",
            createdAt: "2026-10-14T18:00:00.000Z",
            updatedAt: "2026-10-14T18:00:00.000Z",
          },
          token: "<JWT>",
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
      },
    },
  },

  "POST /api/v1/auth/login": {
    name: "Login",
    description: [
      "Logs in CUSTOMER or ADMIN. Returns a Bearer JWT in `data.token`.",
      "",
      "**Role:** Public.",
      "**Auth:** None. Tests script captures `data.token` into `{{token}}`.",
      "",
      "For ADMIN catalog mutations, log in with an existing ADMIN account (registration cannot create ADMIN).",
      "Replace the email with your registered customer (or ADMIN) address.",
    ].join("\n"),
    public: true,
    captureToken: true,
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
            id: SAMPLE_ID.userId,
            email: "customer-demo@example.com",
            role: "CUSTOMER",
            status: "ACTIVE",
          },
          token: "<JWT>",
        },
      },
    },
    errorExample: {
      code: 401,
      status: "Unauthorized",
      body: {
        status: "error",
        message: "Invalid email or password.",
      },
    },
  },

  "POST /api/v1/auth/logout": {
    name: "Logout",
    description: [
      "Revokes the current JWT jti server-side (Mode B). Idempotent: repeated logout with the same token returns 200.",
      "",
      "**Auth:** `Authorization: Bearer {{token}}`.",
      "Invalid, expired, or malformed JWT → 401.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: { status: "success", data: { message: "Logged out" } },
    },
  },

  "GET /api/v1/auth/me": {
    name: "Current user (me)",
    description: [
      "Returns the authenticated user. Never includes passwordHash.",
      "",
      "**Auth:** `Authorization: Bearer {{token}}`.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          user: {
            id: SAMPLE_ID.userId,
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
        message: "Authentication required.",
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
      "**Auth:** `Authorization: Bearer {{token}}`.",
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
        message: "At least one profile field is required.",
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
              id: SAMPLE_ID.categoryId,
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
      "**Auth:** ADMIN — `Authorization: Bearer {{token}}`.",
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
            id: SAMPLE_ID.categoryId,
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
        message: "Category slug already exists.",
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
            id: SAMPLE_ID.categoryId,
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
        message: "Category not found.",
      },
    },
  },

  "PATCH /api/v1/categories/{id}": {
    name: "Update category",
    description:
      "**Auth:** ADMIN Bearer JWT. Name updates do not auto-change slug.",
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
            id: SAMPLE_ID.categoryId,
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
      "Soft-delete (status ARCHIVED). **Auth:** ADMIN Bearer JWT. Idempotent.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          category: {
            id: SAMPLE_ID.categoryId,
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
              id: SAMPLE_ID.subcategoryId,
              name: "Serums",
              slug: "serums",
              categoryId: SAMPLE_ID.categoryId,
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
      "**Auth:** ADMIN Bearer JWT.",
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
            id: SAMPLE_ID.subcategoryId,
            name: "Serums Demo",
            slug: "serums-demo",
            categoryId: SAMPLE_ID.categoryId,
            status: "ACTIVE",
            category: {
              id: SAMPLE_ID.categoryId,
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
        message: "Cannot place an ACTIVE subcategory under an archived category.",
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
            id: SAMPLE_ID.subcategoryId,
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
    description: "**Auth:** ADMIN Bearer JWT.",
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
            id: SAMPLE_ID.subcategoryId,
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
    description: "**Auth:** ADMIN Bearer JWT. Soft archive.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          subcategory: {
            id: SAMPLE_ID.subcategoryId,
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
              id: SAMPLE_ID.productId,
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
      "**Auth:** ADMIN Bearer JWT.",
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
            id: SAMPLE_ID.productId,
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
              id: SAMPLE_ID.subcategoryId,
              name: "Serums Demo",
              slug: "serums-demo",
              status: "ACTIVE",
            },
            category: {
              id: SAMPLE_ID.categoryId,
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
        message: "Product SKU already exists.",
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
            id: SAMPLE_ID.productId,
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
    description: "**Auth:** ADMIN Bearer JWT. Name does not auto-change slug.",
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
            id: SAMPLE_ID.productId,
            stockQty: 8,
            inStock: true,
          },
        },
      },
    },
  },

  "DELETE /api/v1/products/{id}": {
    name: "Archive product",
    description: "**Auth:** ADMIN Bearer JWT. Soft archive.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_ID.productId,
            status: "ARCHIVED",
          },
        },
      },
    },
  },

  "POST /api/v1/products/{id}/images": {
    name: "Add product image",
    description: [
      "Adds an image URL (no file upload). **Auth:** ADMIN Bearer JWT.",
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
            id: SAMPLE_ID.productId,
            images: [
              {
                id: SAMPLE_ID.imageId,
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
        message: "Image URL must be http(s) without credentials.",
      },
    },
  },

  "PATCH /api/v1/products/{id}/images/{imageId}": {
    name: "Update product image",
    description:
      "**Auth:** ADMIN Bearer JWT. Paths use `{{productId}}` and `{{imageId}}`.",
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
            id: SAMPLE_ID.productId,
            images: [
              {
                id: SAMPLE_ID.imageId,
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
      "**Auth:** ADMIN Bearer JWT. Hard-deletes image; promotes next primary if needed.",
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          product: {
            id: SAMPLE_ID.productId,
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
              id: SAMPLE_ID.orderId,
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
        message: "Insufficient permissions.",
      },
    },
  },

  "POST /api/v1/orders": {
    name: "Create order (CUSTOMER)",
    description: [
      "Places an order. Stock is deducted; prices come from the database.",
      "",
      "**Auth:** CUSTOMER only (ADMIN gets 403).",
      "**Auth:** `Authorization: Bearer {{token}}`.",
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
            id: SAMPLE_ID.orderId,
            userId: SAMPLE_ID.userId,
            status: "PENDING",
            totalMinor: 50000,
            currency: "EGP",
            items: [
              {
                productId: SAMPLE_ID.productId,
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
        message: "Insufficient stock.",
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
              id: SAMPLE_ID.orderId,
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
            id: SAMPLE_ID.orderId,
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
        message: "Order not found.",
      },
    },
  },

  "POST /api/v1/orders/{id}/cancel": {
    name: "Cancel order",
    description: [
      "CUSTOMER: PENDING only. ADMIN: PENDING or CONFIRMED. Restocks once.",
      "**Auth:** `Authorization: Bearer {{token}}`. Uses `{{orderId}}`.",
    ].join("\n"),
    successExample: {
      code: 200,
      status: "OK",
      body: {
        status: "success",
        data: {
          order: {
            id: SAMPLE_ID.orderId,
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
        message: "Order cannot be cancelled in its current status.",
      },
    },
  },

  "PATCH /api/v1/orders/{id}/status": {
    name: "Update order status (ADMIN)",
    description: [
      "ADMIN only: PENDING→CONFIRMED or CONFIRMED→FULFILLED (no skip).",
      "**Auth:** ADMIN Bearer JWT. Uses `{{orderId}}`.",
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
            id: SAMPLE_ID.orderId,
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
        message: "Invalid order status transition.",
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

function needsBearer(routePath: string, example: ExampleDef | undefined): boolean {
  if (example?.public) return false;
  if (example?.captureToken) return false;
  if (
    routePath === "/health" ||
    routePath === "/api/v1/health" ||
    routePath === "/api/v1/auth/register" ||
    routePath === "/api/v1/auth/login"
  ) {
    return false;
  }
  // Catalog list/get are public by default; OpenAPI marks protected ops with security.
  return true;
}

function buildHeaders(
  method: string,
  routePath: string,
  example: ExampleDef | undefined,
  operationSecurity: unknown,
): Header[] {
  const headers: Header[] = [];

  if (example?.body !== undefined || method !== "get") {
    if (example?.body !== undefined) {
      headers.push({ key: "Content-Type", value: "application/json" });
    }
  }

  const secured =
    Array.isArray(operationSecurity) && operationSecurity.length > 0;
  if (secured || needsBearer(routePath, example)) {
    // Skip bearer on public capture endpoints
    if (!example?.public && !example?.captureToken) {
      headers.push({
        key: "Authorization",
        value: "Bearer {{token}}",
        description: "JWT from Login/Register (`data.token` → collection `token`).",
      });
    }
  }

  // Public catalog GETs should not force Authorization; strip if OpenAPI has no security
  if (!secured && method === "get" && !example?.public) {
    const idx = headers.findIndex((h) => h.key === "Authorization");
    // Keep Authorization only when OpenAPI security is set or path is clearly protected
    const protectedGet =
      routePath.includes("/auth/me") ||
      routePath.includes("/users/") ||
      routePath.includes("/orders");
    if (!protectedGet && idx >= 0) {
      headers.splice(idx, 1);
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
    const rawUrl =
      queryForUrl && queryForUrl.length > 0
        ? `{{baseUrl}}${rawPath}?${queryForUrl
            .filter((q) => !q.disabled)
            .map((q) => `${q.key}=${q.value}`)
            .join("&")}`
        : `{{baseUrl}}${rawPath}`;

    const events: PostmanEvent[] = [];
    if (example?.captureToken) {
      events.push(scriptEvent("test", AUTH_CAPTURE_TOKEN_TEST));
    }

    const item: PostmanItem = {
      name: example?.name ?? operation.summary ?? key,
      ...(events.length > 0 ? { event: events } : {}),
      request: {
        method: method.toUpperCase(),
        header: buildHeaders(
          method,
          routePath,
          example,
          (operation as { security?: unknown }).security,
        ),
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
          "Tips: Login/Register capture `data.token` into `{{token}}`. Protected requests send `Authorization: Bearer {{token}}`.",
          "Never paste real JWTs into this collection file.",
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
      "2. Import `apps/api/docs/postman/Nesma-Bloom-API.postman_collection.json`.",
      "3. Collection variables: `baseUrl=http://localhost:4000`, leave `token` empty.",
      "",
      "## Quick start",
      "1. Register or Login — Tests captures `data.token` into collection `{{token}}`.",
      "2. ADMIN catalog writes: login as an existing ADMIN (register cannot create ADMIN).",
      "3. Create Category → Subcategory → Product → Image; save IDs into variables.",
      "4. CUSTOMER → Create Order (idempotencyKey) → Get/Cancel.",
      "",
      "## Auth notes",
      "- Register/Login return `{ status, data: { user, token } }` — property name is exactly `token`.",
      "- Protected requests send `Authorization: Bearer {{token}}`.",
      "- Logout revokes the jti (idempotent 200). Other protected routes reject revoked JWTs with 401.",
      "- Never commit real JWTs into generated files.",
      "",
      "Regenerate: pnpm --filter @cosmetics/api docs:postman",
      "Source: apps/api/scripts/generate-postman.mts",
    ].join("\n"),
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "token", value: "" },
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

/**
 * OpenAPI 3.1 description of the Nesma Bloom Cosmetics API.
 * Kept as a maintainable document (not auto-generated from every Zod schema)
 * so cookie/CSRF/idempotency security requirements stay accurate.
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Nesma Bloom Cosmetics API",
    version: "1.0.0",
    description: [
      "REST API for catalog and order management.",
      "",
      "## Authentication",
      "Session cookies after register/login:",
      "- `nb_access` (HttpOnly) — short-lived JWT",
      "- `nb_refresh` (HttpOnly) — refresh token, path `/api/v1/auth`",
      "- `nb_csrf` — readable CSRF token for double-submit",
      "",
      "Mutating requests must send:",
      "- Trusted `Origin` (or `Referer`) matching `CORS_ORIGIN`",
      "- Header `x-csrf-token` equal to `nb_csrf`",
      "",
      "## Idempotency",
      "`POST /api/v1/orders` requires header `Idempotency-Key` (1–128 printable ASCII).",
      "Same key + same payload → HTTP 200 with original order.",
      "First success → HTTP 201. Same key + different payload → HTTP 409.",
      "Keys expire after 24 hours.",
      "",
      "## Money",
      "All amounts are integer EGP piastres (`priceMinor`, `totalMinor`).",
      "",
      "## Order statuses",
      "`PENDING` → `CONFIRMED` → `FULFILLED` (ADMIN).",
      "Cancel: CUSTOMER on `PENDING`; ADMIN on `PENDING`/`CONFIRMED`.",
      "`CANCELLED` and `FULFILLED` are terminal.",
    ].join("\n"),
  },
  servers: [{ url: "http://localhost:4000", description: "Local API" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Categories" },
    { name: "Subcategories" },
    { name: "Products" },
    { name: "Orders" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "nb_access",
        description: "HttpOnly access JWT cookie set by login/register/refresh.",
      },
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", minLength: 1, maxLength: 128 },
        description: "Required for order creation; scoped per authenticated user.",
      },
      CsrfToken: {
        name: "x-csrf-token",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Must match the `nb_csrf` cookie value.",
      },
      Origin: {
        name: "Origin",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Must be in the server CORS/trusted origin allowlist.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["status", "message", "code"],
        properties: {
          status: { type: "string", const: "error" },
          message: { type: "string" },
          code: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                message: { type: "string" },
              },
            },
          },
          requestId: { type: "string" },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          pageSize: { type: "integer" },
          totalItems: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      CatalogStatus: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
      OrderStatus: {
        type: "string",
        enum: ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["CUSTOMER", "ADMIN"] },
          status: { type: "string", enum: ["ACTIVE", "DISABLED"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          profile: { type: "object", additionalProperties: true },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/OrderStatus" },
          totalMinor: { type: "integer" },
          currency: { type: "string", const: "EGP" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          items: { type: "array", items: { type: "object" } },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          sku: { type: "string" },
          priceMinor: { type: "integer" },
          currency: { type: "string", const: "EGP" },
          stockQty: { type: "integer" },
          isAvailable: { type: "boolean" },
          inStock: { type: "boolean" },
          status: { $ref: "#/components/schemas/CatalogStatus" },
          images: { type: "array", items: { type: "object" } },
          subcategory: { type: "object" },
          category: { type: "object" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register CUSTOMER",
        parameters: [
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8, maxLength: 128 },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Registered; sets auth cookies" },
          "409": { description: "Email taken", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        parameters: [
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Logged in; sets auth cookies" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh session",
        description:
          "Concurrent multi-tab refresh: one request wins (200), the other gets 401 without global logout when within the 30s rotation grace window. Delayed reuse of a rotated token after 30s triggers revoke-all.",
        responses: {
          "200": { description: "New cookies issued" },
          "401": { description: "Invalid or raced refresh" },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout current session",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Logged out" } },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "User DTO (never includes passwordHash)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { const: "success" },
                    data: {
                      type: "object",
                      properties: { user: { $ref: "#/components/schemas/User" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/users/me/profile": {
      get: {
        tags: ["Users"],
        summary: "Get own profile",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Profile" } },
      },
      patch: {
        tags: ["Users"],
        summary: "Update own profile",
        security: [{ cookieAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        responses: { "200": { description: "Updated profile" } },
      },
    },
    "/api/v1/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        description: "Public default ACTIVE. ADMIN may use status ARCHIVED/ALL.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "ARCHIVED", "ALL"] } },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["name", "createdAt"] } },
          { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
        ],
        responses: { "200": { description: "Paginated categories" } },
      },
      post: {
        tags: ["Categories"],
        summary: "Create category (ADMIN)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/categories/{id}": {
      get: {
        tags: ["Categories"],
        summary: "Get category",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: { "200": { description: "Category" }, "404": { description: "Not found / hidden" } },
      },
      patch: {
        tags: ["Categories"],
        summary: "Update category (ADMIN)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        tags: ["Categories"],
        summary: "Archive category (ADMIN)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        responses: { "200": { description: "Archived" } },
      },
    },
    "/api/v1/subcategories": {
      get: {
        tags: ["Subcategories"],
        summary: "List subcategories",
        responses: { "200": { description: "Paginated subcategories" } },
      },
      post: {
        tags: ["Subcategories"],
        summary: "Create subcategory (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/subcategories/{id}": {
      get: {
        tags: ["Subcategories"],
        summary: "Get subcategory",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: { "200": { description: "Subcategory" } },
      },
      patch: {
        tags: ["Subcategories"],
        summary: "Update subcategory (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        tags: ["Subcategories"],
        summary: "Archive subcategory (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Archived" } },
      },
    },
    "/api/v1/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        description:
          "Public: ACTIVE + available + ACTIVE parents. Out-of-stock (`stockQty=0`) remains visible with `inStock=false`.",
        responses: { "200": { description: "Paginated products" } },
      },
      post: {
        tags: ["Products"],
        summary: "Create product (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get product",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": {
            description: "Product DTO",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { const: "success" },
                    data: {
                      type: "object",
                      properties: { product: { $ref: "#/components/schemas/Product" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Products"],
        summary: "Update product (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Archive product (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Archived" } },
      },
    },
    "/api/v1/products/{id}/images": {
      post: {
        tags: ["Products"],
        summary: "Add product image URL (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "201": { description: "Product with images" } },
      },
    },
    "/api/v1/products/{id}/images/{imageId}": {
      patch: {
        tags: ["Products"],
        summary: "Update product image (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Product with images" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete product image (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Product with images" } },
      },
    },
    "/api/v1/orders": {
      get: {
        tags: ["Orders"],
        summary: "List all orders (ADMIN)",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Paginated orders" } },
      },
      post: {
        tags: ["Orders"],
        summary: "Create order (CUSTOMER)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/IdempotencyKey" },
          { $ref: "#/components/parameters/Origin" },
          { $ref: "#/components/parameters/CsrfToken" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 50,
                    items: {
                      type: "object",
                      required: ["productId", "quantity"],
                      properties: {
                        productId: { type: "string", format: "uuid" },
                        quantity: { type: "integer", minimum: 1, maximum: 100 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "200": { description: "Idempotent replay" },
          "409": { description: "Stock / idempotency / availability conflict" },
        },
      },
    },
    "/api/v1/orders/my": {
      get: {
        tags: ["Orders"],
        summary: "List own orders",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Paginated own orders" } },
      },
    },
    "/api/v1/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get order (owner or ADMIN)",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": {
            description: "Order",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { const: "success" },
                    data: {
                      type: "object",
                      properties: { order: { $ref: "#/components/schemas/Order" } },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Missing or inaccessible" },
        },
      },
    },
    "/api/v1/orders/{id}/cancel": {
      post: {
        tags: ["Orders"],
        summary: "Cancel order",
        security: [{ cookieAuth: [] }],
        responses: { "200": { description: "Cancelled (idempotent if already cancelled)" } },
      },
    },
    "/api/v1/orders/{id}/status": {
      patch: {
        tags: ["Orders"],
        summary: "Transition order status (ADMIN)",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["CONFIRMED", "FULFILLED"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, "409": { description: "Invalid transition" } },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;

export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItem = {
  id: number;
  productId: number;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

export type CustomerOrder = {
  id: number;
  status: OrderStatus;
  totalMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrderPage = {
  items: CustomerOrder[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2_147_483_647;
}

function isMinor(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}

function isStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

export function formatOrderDate(iso: string, locale: "ar" | "en" = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const parts = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(date);
  return parts
    .map((part) =>
      part.type === "dayPeriod" && locale === "en" ? part.value.toUpperCase() : part.value,
    )
    .join("");
}

function parseItem(value: unknown): OrderItem | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isId(value.id) || !isId(value.productId)) {
    return null;
  }
  if (typeof value.productNameSnapshot !== "string" || value.productNameSnapshot.trim() === "") {
    return null;
  }
  if (typeof value.productSkuSnapshot !== "string") {
    return null;
  }
  if (!isMinor(value.unitPriceMinor) || !isMinor(value.lineTotalMinor)) {
    return null;
  }
  if (
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > 100
  ) {
    return null;
  }
  return {
    id: value.id,
    productId: value.productId,
    productNameSnapshot: value.productNameSnapshot,
    productSkuSnapshot: value.productSkuSnapshot,
    unitPriceMinor: value.unitPriceMinor,
    quantity: value.quantity,
    lineTotalMinor: value.lineTotalMinor,
  };
}

export function parseOrder(value: unknown): CustomerOrder | null {
  if (!isRecord(value) || !isId(value.id) || !isStatus(value.status)) {
    return null;
  }
  if (!isMinor(value.totalMinor) || typeof value.currency !== "string" || value.currency.trim() === "") {
    return null;
  }
  if (!isIso(value.createdAt) || !isIso(value.updatedAt) || !Array.isArray(value.items)) {
    return null;
  }
  const items: OrderItem[] = [];
  for (const item of value.items) {
    const parsed = parseItem(item);
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }
  return {
    id: value.id,
    status: value.status,
    totalMinor: value.totalMinor,
    currency: value.currency,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    items,
  };
}

export function parseOrderPage(value: unknown): OrderPage | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.meta)) {
    return null;
  }
  const { page, pageSize, totalItems, totalPages } = value.meta;
  if (
    typeof page !== "number" ||
    typeof pageSize !== "number" ||
    typeof totalItems !== "number" ||
    typeof totalPages !== "number" ||
    !Number.isInteger(page) ||
    !Number.isInteger(pageSize) ||
    !Number.isInteger(totalItems) ||
    !Number.isInteger(totalPages) ||
    page < 1 ||
    pageSize < 1 ||
    totalItems < 0 ||
    totalPages < 0
  ) {
    return null;
  }
  const items: CustomerOrder[] = [];
  for (const item of value.items) {
    const order = parseOrder(item);
    if (!order) {
      return null;
    }
    items.push(order);
  }
  return {
    items,
    meta: { page, pageSize, totalItems, totalPages },
  };
}

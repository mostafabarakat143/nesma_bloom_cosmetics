import { bearerInit, callExpress } from "@/shared/http/server";
import type { OrderLine } from "../lib/payload";

export const ordersServerService = {
  create: (token: string, key: string, items: OrderLine[]) => callExpress("orders", {
    ...bearerInit(token, "POST", { "content-type": "application/json", "idempotency-key": key }),
    body: JSON.stringify({ items }),
  }),
  cancel: (token: string, id: number) => callExpress(`orders/${id}/cancel`, bearerInit(token, "POST")),
};

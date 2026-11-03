import { callExpress } from "@/shared/http/server";
import type { ContactRequest } from "../types";

export const contactServerService = {
  send: (input: ContactRequest) => callExpress("contact", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(input),
  }),
};

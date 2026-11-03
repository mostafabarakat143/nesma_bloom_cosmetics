import { requestJson } from "@/shared/http/client";
import type { ContactRequest } from "../types";

export const contactService = {
  send: (input: ContactRequest) => requestJson("contact", input),
};

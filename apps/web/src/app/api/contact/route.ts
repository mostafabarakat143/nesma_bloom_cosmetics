import { createValidation } from "@/shared/validation";

import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/shared/http/response";
import { contactServerService } from "@/features/contact/services/contact.server";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

const INVALID = defaultValidation.message("contactInvalid");
const UNAVAILABLE = defaultValidation.message("contactSendError");

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, INVALID);
  }

  const parsed = defaultValidation.contact.request().safeParse(body);
  if (!parsed.success) {
    return jsonError(400, INVALID);
  }

  const result = await contactServerService.send(parsed.data);

  if (result.kind === "unreachable") {
    return jsonError(503, UNAVAILABLE);
  }
  if (result.kind !== "ok") {
    return jsonError(
      result.status >= 400 && result.status < 500 ? 400 : 502,
      UNAVAILABLE,
    );
  }

  return jsonSuccess(201, { sent: true });
}

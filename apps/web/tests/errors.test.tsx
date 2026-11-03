import { createValidation } from "@/shared/validation";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import english from "../messages/en.json";
import arabic from "../messages/ar.json";
import { ErrorMessage } from "@/components/ui/error-message";
import { ErrorState } from "@/components/ui/error-state";
import { errorMessage, requestErrorAction, responseErrorMessage, type RequestFailure } from "@/shared/errors";

import { accountService } from "@/features/account/services/account.service";

const defaultValidation = createValidation();

test("response messages preserve their original value and use a fallback for malformed payloads", () => {
  assert.equal(responseErrorMessage({ message: "Current password is incorrect." }), "Current password is incorrect.");
  assert.equal(responseErrorMessage({ message: "" }), "");
  assert.equal(responseErrorMessage({ message: "  keep spaces  " }), "  keep spaces  ");
  for (const value of [undefined, null, "invalid JSON", { message: 12 }, {}]) {
    assert.equal(responseErrorMessage(value), defaultValidation.messages.unavailable);
  }
});

test("unexpected exceptions never expose internal details", () => {
  assert.equal(errorMessage(new Error("private connection details")), defaultValidation.messages.unavailable);
  assert.equal(errorMessage(undefined), defaultValidation.messages.unavailable);
  assert.equal(errorMessage(new Error("internal"), "Public fallback"), "Public fallback");
  assert.equal(errorMessage("Translated validation error"), "Translated validation error");
});

test("operation-specific fallbacks keep empty-message behavior consistent", () => {
  const failure: RequestFailure = { ok: false, status: 400, message: "" };
  assert.equal(errorMessage(failure), "");
  assert.equal(errorMessage(failure, defaultValidation.messages.loginFailed), defaultValidation.messages.loginFailed);
  assert.equal(errorMessage({ ok: false, status: 503, message: null }), defaultValidation.messages.unavailable);
});

test("only callers that opt into expired-session navigation redirect on 401", () => {
  const failure: RequestFailure = { ok: false, status: 401, message: "Authentication required" };
  assert.deepEqual(requestErrorAction(failure, { loginPath: "/login?expired=1" }), {
    type: "redirect", href: "/login?expired=1",
  });
  // Login failures and wrong-current-password failures stay inline.
  assert.deepEqual(requestErrorAction(failure), { type: "display", message: failure.message, refresh: false });
  assert.deepEqual(requestErrorAction({ ...failure, message: "Current password is incorrect." }), {
    type: "display", message: "Current password is incorrect.", refresh: false,
  });
});

test("conflict refresh is explicit and never creates an automatic retry", () => {
  const failure: RequestFailure = { ok: false, status: 409, message: "Order changed" };
  assert.deepEqual(requestErrorAction(failure, { refreshOnConflict: true }), {
    type: "display", message: "Order changed", refresh: true,
  });
  assert.deepEqual(requestErrorAction(failure), { type: "display", message: "Order changed", refresh: false });
  assert.deepEqual(requestErrorAction({ ...failure, status: 503 }, { refreshOnConflict: true }), {
    type: "display", message: "Order changed", refresh: false,
  });
});

test("the error component preserves IDs, styles and announcement behavior", () => {
  assert.equal(renderToStaticMarkup(createElement(ErrorMessage, { message: null })), "");
  assert.equal(renderToStaticMarkup(createElement(ErrorMessage, { message: "" })), "");
  const alert = renderToStaticMarkup(createElement(ErrorMessage, {
    message: "Invalid input", id: "email-error", className: "custom-error", translate: false,
  }));
  assert.match(alert, /id="email-error"/);
  assert.match(alert, /role="alert"/);
  assert.match(alert, /class="custom-error"/);
  const field = renderToStaticMarkup(createElement(ErrorMessage, {
    message: "Invalid input", id: "field-error", announce: false, translate: false,
  }));
  assert.doesNotMatch(field, /role=/);
});

test("known errors render in the current language and unknown text is safely escaped", () => {
  for (const [locale, messages] of [["en", english], ["ar", arabic]] as const) {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
        <ErrorMessage message={defaultValidation.messages.emailRequired} />
      </NextIntlClientProvider>,
    );
    assert.ok(html.includes(messages.validation.emailRequired));
  }
  const html = renderToStaticMarkup(createElement(ErrorMessage, {
    message: "<script>alert(1)</script>", translate: false,
  }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("the shared page fallback renders even when no translation provider is available", () => {
  const html = renderToStaticMarkup(createElement(ErrorState, {
    title: english.errors.wrongTitle,
    message: english.errors.wrongBody,
    retryLabel: english.errors.tryAgain,
    onRetry() {},
  }));
  assert.ok(html.includes(english.errors.wrongTitle));
  assert.ok(html.includes(english.errors.wrongBody));
  assert.match(html, /type="button"/);
});

test("JSON and upload requests share malformed-response and network failure handling", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not JSON", { status: 502 });
    assert.deepEqual(await accountService.updateProfile({ firstName: "User" }), {
      ok: false, status: 502, message: defaultValidation.messages.unavailable,
    });
    assert.deepEqual(await accountService.uploadAvatar(new File(["image"], "avatar.png", { type: "image/png" })), {
      ok: false, status: 502, message: defaultValidation.messages.unavailable,
    });
    globalThis.fetch = async () => { throw new TypeError("private network detail"); };
    assert.deepEqual(await accountService.uploadAvatar(new File(["image"], "avatar.png", { type: "image/png" })), {
      ok: false, status: 0, message: defaultValidation.messages.unavailable,
    });
  } finally {
    globalThis.fetch = original;
  }
});

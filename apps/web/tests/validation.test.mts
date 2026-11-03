import { createValidation } from "@/shared/validation";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import english from "../messages/en.json";
import arabic from "../messages/ar.json";

const defaultValidation = createValidation();

test("Arabic and English expose the same validation keys", () => {
  assert.deepEqual(Object.keys(arabic.validation).sort(), Object.keys(english.validation).sort());
  for (const value of Object.values(arabic.validation)) assert.ok(value.trim());
  for (const value of Object.values(english.validation)) assert.ok(value.trim());
});

for (const [locale, messages] of [["en", english], ["ar", arabic]] as const) {
  const t = createTranslator({ locale, messages, namespace: "validation" });

  test(`${locale}: schemas return translated field errors`, () => {
    const login = createValidation(t).auth.login().safeParse({ email: "", password: "" });
    assert.equal(login.success, false);
    if (!login.success) {
      assert.deepEqual(defaultValidation.fieldErrors(login.error), {
        email: messages.validation.emailRequired,
        password: messages.validation.passwordRequired,
      });
    }
    const contact = createValidation(t).contact.form().safeParse({ name: " ", phone: "12", email: "wrong", message: "" });
    assert.equal(contact.success, false);
    if (!contact.success) {
      assert.deepEqual(defaultValidation.fieldErrors(contact.error), {
        name: messages.validation.contactName,
        phone: messages.validation.contactPhone,
        email: messages.validation.contactEmailInvalid,
        message: messages.validation.contactMessage,
      });
    }
    const forgot = createValidation(t).auth.forgotPassword().safeParse({ email: "invalid" });
    if (!forgot.success) assert.equal(forgot.error.issues[0].message, messages.validation.emailInvalid);
    else assert.fail("Invalid email was accepted.");
  });

  test(`${locale}: authentication preserves normalization and password limits`, () => {
    assert.deepEqual(createValidation(t).auth.login().parse({ email: " USER@Example.COM ", password: "x" }), {
      email: "user@example.com", password: "x",
    });
    assert.deepEqual(createValidation(t).auth.register().parse({
      email: " USER@Example.COM ", password: " pass123 ", firstName: "  User ", lastName: " ",
    }), { email: "user@example.com", password: " pass123 ", firstName: "User" });
    const short = createValidation(t).auth.register().safeParse({ email: "user@example.com", password: "short" });
    if (!short.success) assert.equal(short.error.issues[0].message, messages.validation.passwordShort);
    else assert.fail("Short password was accepted.");
    const reset = createValidation(t).auth.resetPassword().safeParse({ newPassword: "" });
    if (!reset.success) assert.equal(reset.error.issues[0].message, messages.validation.passwordRequired);
    else assert.fail("Empty password was accepted.");
  });

  test(`${locale}: password change keeps confirmation and reuse checks`, () => {
    const schema = createValidation(t).auth.changePassword();
    const mismatch = schema.safeParse({ currentPassword: "old", newPassword: "new-password", confirmPassword: "other" });
    if (!mismatch.success) assert.equal(defaultValidation.fieldErrors(mismatch.error).confirmPassword, messages.validation.confirmMismatch);
    else assert.fail("Mismatched confirmation was accepted.");
    const same = schema.safeParse({ currentPassword: "same-password", newPassword: "same-password", confirmPassword: "same-password" });
    if (!same.success) assert.equal(defaultValidation.fieldErrors(same.error).newPassword, messages.validation.newDifferent);
    else assert.fail("Reused password was accepted.");
    assert.deepEqual(schema.parse({ currentPassword: "old", newPassword: "new-password", confirmPassword: "new-password" }), {
      currentPassword: "old", newPassword: "new-password",
    });
  });

  test(`${locale}: profile validation retains clearing, strict fields and avatar rules`, () => {
    const schema = createValidation(t).account.profile();
    assert.deepEqual(schema.parse({ firstName: " User ", lastName: " ", phone: "123", avatarUrl: null }), {
      firstName: "User", lastName: null, phone: "123", avatarUrl: null,
    });
    assert.equal(schema.safeParse({ firstName: undefined }).success, false);
    const unsupported = schema.safeParse({ email: "a@b.co" });
    if (!unsupported.success) assert.equal(unsupported.error.issues[0].message, messages.validation.profileUnsupported);
    else assert.fail("Unsupported profile field was accepted.");
    assert.equal(schema.safeParse({ avatarUrl: "https://user:password@example.com/a" }).success, false);
    assert.deepEqual(schema.parse({ avatarUrl: "https://example.com" }), { avatarUrl: "https://example.com/" });
    const fileSchema = createValidation(t).account.avatarFile();
    assert.equal(fileSchema.safeParse({ size: 1, type: "", name: "avatar.JPG" }).success, true);
    const large = fileSchema.safeParse({ size: 5 * 1024 * 1024 + 1, type: "image/png", name: "avatar.png" });
    if (!large.success) assert.equal(large.error.issues[0].message, messages.validation.profilePhotoSize);
    else assert.fail("Oversized image was accepted.");
  });

  test(`${locale}: contact and newsletter keep their distinct rules`, () => {
    assert.deepEqual(createValidation(t).contact.form().parse({ name: " User ", phone: " 123 ", email: " USER@Example.COM ", message: " Hello " }), {
      name: "User", phone: "123", email: "USER@Example.COM", message: "Hello",
    });
    // The original newsletter accepts an @ sign; registration requires a full address.
    assert.equal(createValidation(t).newsletter().safeParse({ email: "a@" }).success, true);
    const invalid = createValidation(t).newsletter().safeParse({ email: "no-address" });
    if (!invalid.success) assert.equal(invalid.error.issues[0].message, messages.validation.newsletterEmail);
    else assert.fail("Invalid newsletter value was accepted.");
  });

  test(`${locale}: order validation preserves sorting, limits and first-error priority`, () => {
    const schema = createValidation(t).orders.create();
    assert.deepEqual(schema.parse({ items: [{ productId: 2, quantity: 3 }, { productId: 1, quantity: 1 }] }), {
      items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 3 }],
    });
    const duplicate = schema.safeParse({ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }, { productId: 2, quantity: 0 }] });
    if (!duplicate.success) assert.equal(duplicate.error.issues[0].message, messages.validation.duplicateProducts);
    else assert.fail("Duplicate product was accepted.");
    const invalid = schema.safeParse({ items: [{ productId: 1, quantity: 101 }] });
    if (!invalid.success) assert.equal(invalid.error.issues[0].message, messages.validation.quantityMax);
    else assert.fail("Quantity above limit was accepted.");
  });

  test(`${locale}: price and reset-token validation preserve boundary behavior`, () => {
    const prices = createValidation(t).catalog.price();
    assert.equal(prices.parse(" 15.50 "), 1550);
    assert.equal(prices.parse(" "), null);
    for (const price of ["15.555", "-1", "21474836.48", "1e3"]) {
      const parsed = prices.safeParse(price);
      if (!parsed.success) assert.equal(parsed.error.issues[0].message, messages.validation.priceInvalid);
      else assert.fail("Invalid price was accepted: " + price);
    }
    const token = createValidation(t).auth.resetToken();
    assert.equal(token.safeParse("x".repeat(20)).success, true);
    assert.equal(token.safeParse("x".repeat(19)).success, false);
    assert.equal(token.safeParse("x".repeat(201)).success, false);
    assert.equal(token.safeParse("x".repeat(20) + "\n").success, false);
  });
}

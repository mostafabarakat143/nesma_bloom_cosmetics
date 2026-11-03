import { createTranslator } from "next-intl";
import { z } from "zod";
import english from "../../messages/en.json";
import { isRecord } from "./lib/guards";

export type ValidationMessageKey = keyof typeof english.validation;
export type ValidationTranslator = (key: ValidationMessageKey) => string;
export type AvatarFileInput = { size: number; type: string; name: string };

export function createValidation(t: ValidationTranslator = createTranslator({
  locale: "en", messages: english, namespace: "validation",
})) {
  // 1. Shared limits and input helpers

  const validationLimits = {
    email: 255,
    password: 128,
    name: 100,
    phoneMin: 3,
    phone: 30,
    avatarUrl: 2048,
    avatarBytes: 5 * 1024 * 1024,
    id: 2_147_483_647,
    orderLines: 50,
    orderQuantity: 100,
  } as const;

  const recordOrEmpty = (input: unknown) => isRecord(input) && !Array.isArray(input) ? input : {};
  const stringOrEmpty = (input: unknown) => typeof input === "string" ? input : "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 2. Translated messages and reusable error mapping

  function validationMessages() {
    return {
      emailRequired: t("emailRequired"),
      emailInvalid: t("emailInvalid"),
      emailTooLong: t("emailTooLong"),
      passwordRequired: t("passwordRequired"),
      passwordShort: t("passwordShort"),
      passwordTooLong: t("passwordTooLong"),
      firstNameInvalid: t("firstNameInvalid"),
      lastNameInvalid: t("lastNameInvalid"),
      resetInvalid: t("resetInvalid"),
      malformed: t("malformed"),
      rejected: t("rejected"),
      unavailable: t("unavailable"),
      sessionEnded: t("sessionEnded"),
      loggedOut: t("loggedOut"),
      revokeUnconfirmed: t("revokeUnconfirmed"),
      resetSuccess: t("resetSuccess"),
      passwordChanged: t("passwordChanged"),
      forgot: t("forgot"),
      duplicate: t("duplicate"),
      loginFailed: t("loginFailed"),
    };
  }

  function avatarMessages() {
    return { type: t("profilePhotoType"), size: t("profilePhotoSize"), missing: t("profilePhotoMissing") };
  }

  let cachedMessages: ReturnType<typeof validationMessages> | undefined;
  let cachedAvatarMessages: ReturnType<typeof avatarMessages> | undefined;
  let knownMessages: Map<string, ValidationMessageKey> | undefined;

  function knownValidationMessageKey(message: string): ValidationMessageKey | null {
    if (!knownMessages) {
      const englishT = createTranslator({ locale: "en", messages: english, namespace: "validation" });
      knownMessages = new Map(
        (Object.keys(english.validation) as ValidationMessageKey[]).map((key) => [englishT(key), key]),
      );
    }
    return knownMessages.get(message) ?? null;
  }

  function fieldErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = typeof issue.path[0] === "string" ? issue.path[0] : "form";
      errors[field] ??= issue.message;
    }
    return errors;
  }

  function parseValidation<T>(schema: z.ZodType<T>, input: unknown) {
    const result = schema.safeParse(input);
    return result.success
      ? { ok: true as const, value: result.data }
      : { ok: false as const, errors: fieldErrors(result.error) };
  }

  // 3. Shared field builders

  function emailSchema() {
    return z.preprocess(stringOrEmpty, z.string().trim().toLowerCase()
      .min(1, t("emailRequired")).max(validationLimits.email, t("emailTooLong"))
      .regex(emailPattern, t("emailInvalid")));
  }

  function passwordSchema(isNew = false, required: ValidationMessageKey = "passwordRequired") {
    const password = z.string().min(1, t(required));
    return z.preprocess(stringOrEmpty, (isNew ? password.min(8, t("passwordShort")) : password)
      .max(validationLimits.password, t("passwordTooLong")));
  }

  function optionalNameSchema(key: "firstNameInvalid" | "lastNameInvalid") {
    return z.preprocess((value) => value === null ? undefined : value,
      z.string({ error: t(key) }).trim().max(validationLimits.name, t(key)).optional());
  }

  function nullableTextSchema(key: ValidationMessageKey, max: number, min = 0) {
    return z.preprocess((value) => value === null || (typeof value === "string" && !value.trim()) ? null : value,
      z.string({ error: t(key) }).trim().max(max, t(key)).min(min, t(key)).nullable());
  }

  // 4. Authentication

  function createLoginSchema() {
    return z.preprocess(recordOrEmpty, z.object({ email: emailSchema(), password: passwordSchema() }));
  }

  function createRegisterSchema() {
    return z.preprocess(recordOrEmpty, z.object({
      email: emailSchema(), password: passwordSchema(true),
      firstName: optionalNameSchema("firstNameInvalid"), lastName: optionalNameSchema("lastNameInvalid"),
    }).transform(({ email, password, firstName, lastName }) => ({
      email, password, ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}),
    })));
  }

  function createForgotPasswordSchema() {
    return z.preprocess(recordOrEmpty, z.object({ email: emailSchema() }));
  }

  function createResetPasswordSchema() {
    return z.preprocess(recordOrEmpty, z.object({ newPassword: passwordSchema(true) }));
  }

  function createResetTokenSchema() {
    return z.string({ error: t("resetInvalid") }).min(20, t("resetInvalid"))
      .max(200, t("resetInvalid")).refine((value) => !/[\r\n]/.test(value), t("resetInvalid"));
  }

  function createChangePasswordSchema() {
    return z.object({
      currentPassword: passwordSchema(false, "currentRequired"),
      newPassword: passwordSchema(true, "newRequired"),
      confirmPassword: z.string({ error: t("confirmMismatch") }),
    }, { error: t("malformed") }).refine((value) => value.confirmPassword === value.newPassword, {
      path: ["confirmPassword"], error: t("confirmMismatch"),
    }).refine((value) => !(
      value.currentPassword.length > 0 && value.currentPassword.length <= validationLimits.password &&
      value.newPassword.length >= 8 && value.newPassword.length <= validationLimits.password &&
      value.currentPassword === value.newPassword
    ), { path: ["newPassword"], error: t("newDifferent") })
      .transform(({ currentPassword, newPassword }) => ({ currentPassword, newPassword }));
  }

  function createChangePasswordRequestSchema() {
    return z.unknown().transform((body, context): z.input<ReturnType<typeof createChangePasswordSchema>> => {
      const fail = (key: ValidationMessageKey) => {
        context.addIssue({ code: "custom", message: t(key) });
        return z.NEVER;
      };
      if (!isRecord(body)) return fail("malformed");
      if (Object.keys(body).some((key) => key !== "currentPassword" && key !== "newPassword")) {
        return fail("passwordFieldsOnly");
      }
      if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
        return fail("currentRequired");
      }
      return { currentPassword: body.currentPassword, newPassword: body.newPassword, confirmPassword: body.newPassword };
    }).pipe(createChangePasswordSchema());
  }

  // 5. Account and avatar

  function createAvatarUrlSchema() {
    return z.string({ error: t("profileAvatar") }).trim().min(1, t("profileAvatar"))
      .max(validationLimits.avatarUrl, t("profileAvatar")).refine((value) => {
        try {
          const url = new URL(value);
          return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
        } catch { return false; }
      }, t("profileAvatar")).transform((value) => new URL(value).href);
  }

  function createProfileSchema() {
    const fields = ["firstName", "lastName", "phone", "avatarUrl"];
    const record = z.custom<Record<string, unknown>>((value) => isRecord(value), t("profileRequired"))
      .refine((value) => Object.keys(value).every((key) => fields.includes(key)), t("profileUnsupported"))
      .refine((value) => Object.keys(value).length > 0, t("profileRequired"));
    const avatar = z.preprocess((value) => value === null || (typeof value === "string" && !value.trim()) ? null : value,
      createAvatarUrlSchema().nullable());
    const shape = z.object({
      firstName: nullableTextSchema("profileFirstName", validationLimits.name).optional(),
      lastName: nullableTextSchema("profileLastName", validationLimits.name).optional(),
      phone: nullableTextSchema("profilePhone", validationLimits.phone, validationLimits.phoneMin).optional(),
      avatarUrl: avatar.optional(),
    }, { error: t("profileRequired") });
    return record.transform((input, context) => {
      const result = shape.safeParse(input);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({ code: "custom", path: issue.path, message: issue.message });
        }
      }
      const keys = {
        firstName: "profileFirstName", lastName: "profileLastName",
        phone: "profilePhone", avatarUrl: "profileAvatar",
      } as const;
      for (const key of Object.keys(keys) as (keyof typeof keys)[]) {
        if (key in input && input[key] === undefined) {
          context.addIssue({ code: "custom", path: [key], message: t(keys[key]) });
        }
      }
      return result.success ? result.data : z.NEVER;
    });
  }

  function createAvatarFileSchema() {
    return z.custom<AvatarFileInput>((value) => isRecord(value) && typeof value.size === "number" &&
      typeof value.type === "string" && typeof value.name === "string", t("profilePhotoMissing"))
      .refine((file) => file.size > 0, t("profilePhotoMissing"))
      .refine((file) => file.size <= validationLimits.avatarBytes, t("profilePhotoSize"))
      .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase()) ||
        (file.type === "" && /\.(jpe?g|png|webp)$/i.test(file.name)), t("profilePhotoType"));
  }

  // 6. Contact and newsletter

  function createContactSchema() {
    return z.object({
      name: z.string({ error: t("contactName") }).trim().min(1, t("contactName")),
      phone: z.string({ error: t("contactPhone") }).trim().min(3, t("contactPhone")),
      email: z.string({ error: t("contactEmailRequired") }).trim()
        .min(1, t("contactEmailRequired")).regex(emailPattern, t("contactEmailInvalid")),
      message: z.string({ error: t("contactMessage") }).trim().min(1, t("contactMessage")),
    }, { error: t("contactInvalid") });
  }

  function createContactRequestSchema() {
    return createContactSchema().extend({
      name: z.string({ error: t("contactName") }).trim().min(1, t("contactName")).max(120, t("contactInvalid")),
      phone: z.string({ error: t("contactPhone") }).trim().min(3, t("contactPhone")).max(30, t("contactInvalid")),
      email: z.string({ error: t("contactEmailRequired") }).trim().min(1, t("contactEmailRequired"))
        .max(255, t("contactInvalid")).regex(emailPattern, t("contactEmailInvalid")),
      message: z.string({ error: t("contactMessage") }).trim().min(1, t("contactMessage")).max(5000, t("contactInvalid")),
    });
  }

  function createNewsletterSchema() {
    return z.object({ email: z.string({ error: t("newsletterEmail") })
        .refine((email) => Boolean(email.trim()) && email.includes("@"), t("newsletterEmail")) }, { error: t("newsletterEmail") });
  }

  // 7. Orders and catalog

  function createOrderSchema() {
    const line = z.custom<Record<string, unknown>>(isRecord, t("orderLineFields"))
      .refine((value) => Object.keys(value).every((key) => key === "productId" || key === "quantity"), t("orderLineFields"))
      .transform((value) => ({ ...value }))
      .pipe(z.object({
        productId: z.number({ error: t("productIdInteger") }).refine(Number.isInteger, t("productIdInteger"))
          .min(1, t("productIdPositive")).max(validationLimits.id, t("productIdPositive")),
        quantity: z.number({ error: t("quantityInteger") }).refine(Number.isInteger, t("quantityInteger"))
          .min(1, t("quantityMin")).max(validationLimits.orderQuantity, t("quantityMax")),
      }));
    const items = z.array(z.unknown(), { error: t("orderItemsRequired") })
      .min(1, t("orderItemsEmpty")).max(validationLimits.orderLines, t("orderItemsMax"))
      .transform((entries, context) => {
        const values: { productId: number; quantity: number }[] = [];
        const seen = new Set<number>();
        for (const [index, entry] of entries.entries()) {
          const parsed = line.safeParse(entry);
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            context.addIssue({ code: "custom", path: [index, ...issue.path], message: issue.message });
            return z.NEVER;
          }
          if (seen.has(parsed.data.productId)) {
            context.addIssue({ code: "custom", path: [index], message: t("duplicateProducts") });
            return z.NEVER;
          }
          seen.add(parsed.data.productId);
          values.push(parsed.data);
        }
        return values.sort((a, b) => a.productId - b.productId);
      });
    return z.custom<Record<string, unknown>>(isRecord, t("orderFieldsOnly"))
      .refine((value) => Object.keys(value).every((key) => key === "items"), t("orderFieldsOnly"))
      .transform((value) => ({ ...value }))
      .pipe(z.object({ items }));
  }

  function createIdempotencyKeySchema() {
    return z.string({ error: t("idempotencyRequired") }).trim().min(1, t("idempotencyRequired"))
      .max(128, t("idempotencyRequired")).regex(/^[\x21-\x7E]+$/, t("idempotencyRequired"));
  }

  function createPriceSchema() {
    return z.string({ error: t("priceInvalid") }).trim().refine((value) => {
      if (!value) return true;
      if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
      const [major, fraction = ""] = value.split(".");
      const minor = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
      return major.length <= 10 && Number.isSafeInteger(minor) && minor >= 0 && minor <= validationLimits.id;
    }, t("priceInvalid")).transform((value) => {
      if (!value) return null;
      const [major, fraction = ""] = value.split(".");
      return Number(major) * 100 + Number(fraction.padEnd(2, "0"));
    });
  }

  // 8. Public API: access everything through createValidation(t).

  return {
    auth: {
      login: createLoginSchema,
      register: createRegisterSchema,
      forgotPassword: createForgotPasswordSchema,
      resetPassword: createResetPasswordSchema,
      resetToken: createResetTokenSchema,
      changePassword: createChangePasswordSchema,
      changePasswordRequest: createChangePasswordRequestSchema,
    },
    account: {
      profile: createProfileSchema,
      avatarUrl: createAvatarUrlSchema,
      avatarFile: createAvatarFileSchema,
    },
    contact: { form: createContactSchema, request: createContactRequestSchema },
    newsletter: createNewsletterSchema,
    orders: { create: createOrderSchema, idempotencyKey: createIdempotencyKeySchema },
    catalog: { price: createPriceSchema },
    fields: {
      email: emailSchema,
      password: passwordSchema,
      name: optionalNameSchema,
      text: nullableTextSchema,
    },
    helpers: { recordOrEmpty, stringOrEmpty },
    limits: validationLimits,
    message: t,
    get messages() { return (cachedMessages ??= validationMessages()); },
    get avatarMessages() { return (cachedAvatarMessages ??= avatarMessages()); },
    messageKey: knownValidationMessageKey,
    parse: parseValidation,
    fieldErrors,
  };
}

// Types are derived from the public API, with no duplicate schema definitions.
export type Validation = ReturnType<typeof createValidation>;
export type LoginSchema = ReturnType<Validation["auth"]["login"]>;
export type RegisterSchema = ReturnType<Validation["auth"]["register"]>;
export type ForgotPasswordSchema = ReturnType<Validation["auth"]["forgotPassword"]>;
export type ResetPasswordSchema = ReturnType<Validation["auth"]["resetPassword"]>;
export type ChangePasswordSchema = ReturnType<Validation["auth"]["changePassword"]>;
export type ProfileSchema = ReturnType<Validation["account"]["profile"]>;
export type AvatarFileSchema = ReturnType<Validation["account"]["avatarFile"]>;
export type ContactSchema = ReturnType<Validation["contact"]["form"]>;

"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useContactForm } from "@/features/contact/hooks/use-contact-form";

import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/fields";

const controlClass =
  "mt-2 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";
const contactFieldProps = {
  labelClassName: "block text-sm text-ink",
  controlClassName: `${controlClass} h-12`,
  errorRole: "alert" as const,
};

export function ContactForm() {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.contact.form();
  const {
    t,
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,
    message,
    setMessage,
    nameError,
    phoneError,
    emailError,
    messageError,
    pending,
    sendError,
    onSubmit,
  } = useContactForm(schema);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto mt-16 w-full max-w-3xl space-y-5 rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10"
    >
      <h2 className="font-display text-4xl text-ink">{t("formTitle")}</h2>
      <TextField
        {...contactFieldProps}
        id="contact-name"
        name="name"
        label={t("name")}
        type="text"
        autoComplete="name"
        placeholder={t("namePlaceholder")}
        value={name}
        maxLength={120}
        error={nameError ?? undefined}
        onChange={setName}
      />
      <TextField
        {...contactFieldProps}
        id="contact-phone"
        name="phone"
        label={t("phoneField")}
        type="tel"
        autoComplete="tel"
        placeholder={t("phonePlaceholder")}
        value={phone}
        maxLength={30}
        error={phoneError ?? undefined}
        onChange={setPhone}
      />
      <TextField
        {...contactFieldProps}
        id="contact-email"
        name="email"
        label={t("emailField")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        maxLength={255}
        error={emailError ?? undefined}
        onChange={setEmail}
      />
      <TextAreaField
        {...contactFieldProps}
        id="contact-message"
        name="message"
        label={t("message")}
        placeholder={t("messagePlaceholder")}
        value={message}
        maxLength={5000}
        rows={6}
        error={messageError ?? undefined}
        onChange={setMessage}
        controlClassName={`${controlClass} py-3`}
      />
      <ErrorMessage message={sendError} className="text-sm text-rose-deep" translate={false} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { TextAreaField, TextField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

const controlClass =
  "mt-2 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";
const contactFieldProps = {
  labelClassName: "block text-sm text-ink",
  controlClassName: `${controlClass} h-12`,
  errorRole: "alert" as const,
};

export function ContactForm() {
  const t = useTranslations("contact");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const nameError = submitted && !name.trim() ? t("nameError") : null;
  const phoneError =
    submitted && phone.trim().length < 3 ? t("phoneError") : null;
  const emailValue = email.trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const emailError = submitted
    ? !emailValue
      ? t("emailRequired")
      : emailLooksValid
        ? null
        : t("emailInvalid")
    : null;
  const messageError = submitted && !message.trim() ? t("messageError") : null;
  const valid =
    name.trim().length > 0 &&
    phone.trim().length >= 3 &&
    emailLooksValid &&
    message.trim().length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setSendError(null);
    if (!valid || pending) {
      return;
    }

    setPending(true);
    const result = await postAuth("/api/contact", {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    setPending(false);

    if (!result.ok) {
      setSendError(t("sendError"));
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
    setSubmitted(false);
    showToast(t("notice"));
  }

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
      {sendError ? (
        <p role="alert" className="text-sm text-rose-deep">
          {sendError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}

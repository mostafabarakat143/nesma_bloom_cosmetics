"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

const labelClass = "block text-sm text-ink";
const controlClass =
  "mt-2 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

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
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          {t("name")}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          value={name}
          maxLength={120}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "contact-name-error" : undefined}
          onChange={(event) => setName(event.target.value)}
          className={`${controlClass} h-12`}
        />
        {nameError ? (
          <p id="contact-name-error" role="alert" className="mt-2 text-sm text-rose-deep">
            {nameError}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contact-phone" className={labelClass}>
          {t("phoneField")}
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          value={phone}
          maxLength={30}
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? "contact-phone-error" : undefined}
          onChange={(event) => setPhone(event.target.value)}
          className={`${controlClass} h-12`}
        />
        {phoneError ? (
          <p id="contact-phone-error" role="alert" className="mt-2 text-sm text-rose-deep">
            {phoneError}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contact-email" className={labelClass}>
          {t("emailField")}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          maxLength={255}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "contact-email-error" : undefined}
          onChange={(event) => setEmail(event.target.value)}
          className={`${controlClass} h-12`}
        />
        {emailError ? (
          <p id="contact-email-error" role="alert" className="mt-2 text-sm text-rose-deep">
            {emailError}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          placeholder={t("messagePlaceholder")}
          value={message}
          maxLength={5000}
          rows={6}
          aria-invalid={messageError ? true : undefined}
          aria-describedby={messageError ? "contact-message-error" : undefined}
          onChange={(event) => setMessage(event.target.value)}
          className={`${controlClass} py-3`}
        />
        {messageError ? (
          <p id="contact-message-error" role="alert" className="mt-2 text-sm text-rose-deep">
            {messageError}
          </p>
        ) : null}
      </div>
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

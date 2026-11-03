"use client";

import { createValidation, type ContactSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { showToast } from "@/components/ui/toast";
import { useContact } from "@/features/contact/hooks/use-contact";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useContactForm(schema: ContactSchema) {
  const t = useTranslations("contact");
  const validationT = useTranslations("validation");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { mutateAsync: sendContact, isPending: pending } = useContact();
  const { error: sendError, clearError, reportError } = useErrorHandler();

  const parsed = defaultValidation.parse(schema, { name, phone, email, message });
  const errors = submitted && !parsed.ok ? parsed.errors : {};
  const nameError = errors.name ?? null;
  const phoneError = errors.phone ?? null;
  const emailError = errors.email ?? null;
  const messageError = errors.message ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    clearError();
    if (!parsed.ok || pending) {
      return;
    }

    const result = await sendContact(parsed.value);

    if (!result.ok) {
      reportError(validationT("contactSendError"));
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
    setSubmitted(false);
    showToast(t("notice"));
  }

  return {
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
  };
}

"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

const labelClass = "block text-sm text-ink";
const controlClass =
  "mt-2 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

function fieldError(value: string, label: string) {
  return value.trim() ? null : `Enter your ${label}.`;
}

export function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted ? fieldError(name, "name") : null;
  const phoneError = submitted ? fieldError(phone, "phone number") : null;
  const emailError = submitted
    ? !email.trim()
      ? "Enter your email."
      : email.includes("@")
        ? null
        : "Enter an email address."
    : null;
  const messageError = submitted ? fieldError(message, "message") : null;
  const notice =
    submitted && !nameError && !phoneError && !emailError && !messageError
      ? "This form does not send messages. Use the email or phone above."
      : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto mt-16 w-full max-w-3xl space-y-5 rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10"
    >
      <h2 className="font-display text-4xl text-ink">Contact us</h2>
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          maxLength={100}
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
          Phone
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="Your phone number"
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
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
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
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          placeholder="How can we help?"
          value={message}
          maxLength={1000}
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
      {notice ? (
        <p role="status" className="text-sm text-rose-deep">
          {notice}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit">Send message</Button>
      </div>
    </form>
  );
}

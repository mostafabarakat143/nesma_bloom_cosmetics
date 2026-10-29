"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { useKnownMessage } from "@/components/i18n/known-text";

const labelClass = "block text-sm font-medium text-ink";
const controlClass =
  "w-full rounded-2xl border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep aria-[invalid=true]:border-rose-deep";
const fieldClass = `h-11 ${controlClass}`;

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  errorRole?: "alert";
  labelClassName?: string;
};

function Field({
  id,
  label,
  error,
  errorRole,
  labelClassName = labelClass,
  children,
}: FieldProps & { children: ReactNode }) {
  const translate = useKnownMessage();
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role={errorRole} className="mt-2 text-sm text-rose-deep">
          {translate(error)}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = FieldProps & {
  name?: string;
  type?: "email" | "text" | "tel" | "url";
  autoComplete: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  readOnly?: boolean;
  controlClassName?: string;
  onChange: (value: string) => void;
};

export function TextField({
  id,
  name = id,
  label,
  type = "text",
  autoComplete,
  value,
  error,
  errorRole,
  labelClassName,
  maxLength,
  placeholder,
  readOnly = false,
  controlClassName,
  onChange,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <Field
      id={id}
      label={label}
      error={error}
      errorRole={errorRole}
      labelClassName={labelClassName}
    >
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={
          controlClassName ?? `${fieldClass} mt-2 ${readOnly ? "text-muted" : ""}`
        }
      />
    </Field>
  );
}

type TextAreaFieldProps = Omit<TextFieldProps, "type" | "autoComplete"> & {
  autoComplete?: string;
  rows?: number;
};

export function TextAreaField({
  id,
  name = id,
  label,
  autoComplete,
  value,
  error,
  errorRole,
  labelClassName,
  maxLength,
  placeholder,
  readOnly = false,
  controlClassName,
  rows = 6,
  onChange,
}: TextAreaFieldProps) {
  return (
    <Field
      id={id}
      label={label}
      error={error}
      errorRole={errorRole}
      labelClassName={labelClassName}
    >
      <textarea
        id={id}
        name={name}
        autoComplete={autoComplete}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={
          controlClassName ??
          `${controlClass} mt-2 py-3 ${readOnly ? "text-muted" : ""}`
        }
      />
    </Field>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function PasswordField({
  id,
  label,
  autoComplete,
  value,
  error,
  hint,
  placeholder,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("auth");
  const translate = useKnownMessage();
  const hintId = useId();
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          maxLength={128}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} pe-16`}
        />
        <button
          type="button"
          className="absolute inset-y-1 end-1 rounded-xl px-3 text-sm text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
          aria-pressed={visible}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? t("hide") : t("show")}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-rose-deep">
          {translate(error)}
        </p>
      ) : null}
    </div>
  );
}

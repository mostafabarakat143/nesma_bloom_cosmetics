"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useProfileForm } from "@/features/account/hooks/use-profile-form";

import { KnownText } from "@/components/i18n/known-text";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { AccountAvatar } from "@/features/account/components/account-avatar";
import {
  type AccountProfile
} from "@/features/account/lib/profile-parse";

export function ProfileForm({ profile }: { profile: AccountProfile; }) {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.account.profile();
  const {
    t,
    saved,
    draft,
    setDraft,
    photo,
    shownAvatar,
    removePhoto,
    setRemovePhoto,
    fileInputKey,
    editing,
    pending,
    errors,
    setErrors,
    formError,
    savedMessage,
    view,
    clearPhotoChoice,
    beginEdit,
    cancelEdit,
    choosePhoto,
    save,
  } = useProfileForm({ profile, schema, avatarSchema: validation.account.avatarFile() });

  return (
    <div>
      <div className="flex items-center gap-4">
        <AccountAvatar initials={view.initials} avatarUrl={shownAvatar} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-display text-3xl text-ink">{view.fullName}</p>
          <p className="truncate text-sm text-muted">{saved.email}</p>
        </div>
      </div>

      {savedMessage ? (
        <p role="status" className="mt-6 text-sm text-ink">
          <KnownText value={savedMessage} />
        </p>
      ) : null}
      <ErrorMessage message={formError} className="mt-6 text-sm text-rose-deep" />

      {editing ? (
        <form
          className="mt-8 space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField
            id="profile-first-name"
            label={t("firstName")}
            autoComplete="given-name"
            value={draft.firstName}
            error={errors.firstName}
            maxLength={100}
            onChange={(firstName) => setDraft((current) => ({ ...current, firstName }))}
          />
          <TextField
            id="profile-last-name"
            label={t("lastName")}
            autoComplete="family-name"
            value={draft.lastName}
            error={errors.lastName}
            maxLength={100}
            onChange={(lastName) => setDraft((current) => ({ ...current, lastName }))}
          />
          <TextField
            id="profile-email"
            label={t("email")}
            type="email"
            autoComplete="email"
            value={saved.email}
            readOnly
            onChange={() => undefined}
          />
          <p className="-mt-3 text-sm text-muted">{t("emailNote")}</p>
          <TextField
            id="profile-phone"
            label={t("phone")}
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            error={errors.phone}
            maxLength={30}
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />
          <div>
            <label htmlFor="profile-avatar" className="block text-sm font-medium text-ink">
              {t("imageAddress")}
            </label>
            <input
              key={fileInputKey}
              id="profile-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="mt-2 block w-full text-sm text-ink file:me-3 file:h-11 file:rounded-2xl file:border-0 file:bg-blush file:px-4 file:text-sm file:font-medium file:text-rose-deep"
              aria-invalid={errors.avatarUrl ? true : undefined}
              aria-describedby={errors.avatarUrl ? "profile-avatar-error" : "profile-avatar-hint"}
              onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            />
            {errors.avatarUrl ? (
              <ErrorMessage message={errors.avatarUrl} id="profile-avatar-error" className="mt-2 text-sm text-rose-deep" announce={false} />
            ) : (
              <p id="profile-avatar-hint" className="mt-2 text-sm text-muted">
                {t("imageHint")}
              </p>
            )}
            {(photo || (saved.avatarUrl && !removePhoto)) ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    clearPhotoChoice();
                    setRemovePhoto(true);
                    setErrors((current) => ({ ...current, avatarUrl: undefined }));
                  }}
                  disabled={pending}
                >
                  {t("removePhoto")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-8">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted">{t("firstName")}</dt>
              <dd className="mt-1 text-ink">{saved.firstName ?? t("notAdded")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("lastName")}</dt>
              <dd className="mt-1 text-ink">{saved.lastName ?? t("notAdded")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("email")}</dt>
              <dd className="mt-1 break-all text-ink">{saved.email}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("phone")}</dt>
              <dd className="mt-1 text-ink">{saved.phone ?? t("notAdded")}</dd>
            </div>
          </dl>
          <div className="mt-8">
            <Button type="button" onClick={beginEdit}>
              {t("edit")}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

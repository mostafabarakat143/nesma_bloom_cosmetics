"use client";

import { useTranslations } from "next-intl";
import { KnownText } from "@/components/i18n/known-text";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AccountAvatar } from "@/components/account/account-avatar";
import { postAuth, postAuthFile } from "@/components/auth/post-auth";
import { TextField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { toAccountView } from "@/lib/auth/account-view";
import { avatarFileError } from "@/lib/auth/avatar-file";
import {
  parseSavedProfile,
  type AccountProfile,
} from "@/lib/auth/profile-parse";
import {
  PROFILE_MESSAGES,
  profileUpdateError,
  validateProfileUpdate,
  type ProfileFieldErrors,
} from "@/lib/auth/profile-update";

function draftFrom(profile: AccountProfile) {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
  };
}

function displayAvatar(url: string | null, revision: number): string | null {
  if (!url || revision === 0) {
    return url;
  }
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${revision}`;
}

export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const t = useTranslations("account");
  const [saved, setSaved] = useState(profile);
  const [draft, setDraft] = useState(() => draftFrom(profile));
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const view = toAccountView(saved.email, saved);
  const shownAvatar = previewUrl
    ? previewUrl
    : removePhoto
      ? null
      : displayAvatar(saved.avatarUrl, photoRevision);

  function clearPhotoChoice() {
    setPhoto(null);
    setPreviewUrl(null);
    setFileInputKey((current) => current + 1);
  }

  function beginEdit() {
    setDraft(draftFrom(saved));
    clearPhotoChoice();
    setRemovePhoto(false);
    setErrors({});
    setFormError(null);
    setSavedMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftFrom(saved));
    clearPhotoChoice();
    setRemovePhoto(false);
    setErrors({});
    setFormError(null);
    setEditing(false);
  }

  function choosePhoto(file: File | null) {
    setFormError(null);
    setSavedMessage(null);
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    const problem = avatarFileError(file);
    if (problem) {
      setPhoto(null);
      setPreviewUrl(null);
      setFileInputKey((current) => current + 1);
      setErrors((current) => ({ ...current, avatarUrl: problem }));
      return;
    }
    setErrors((current) => ({ ...current, avatarUrl: undefined }));
    setRemovePhoto(false);
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function save() {
    const parsed = validateProfileUpdate({
      ...draft,
      ...(removePhoto && !photo ? { avatarUrl: null } : {}),
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(profileUpdateError(parsed.errors));
      setSavedMessage(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await postAuth("/api/account/profile", parsed.value, "PATCH");
    if (!result.ok) {
      setPending(false);
      if (result.status === 401) {
        router.push("/login?expired=1");
        router.refresh();
        return;
      }
      setFormError(result.message);
      return;
    }

    let next = parseSavedProfile(result.data.profile);
    if (photo) {
      const uploaded = await postAuthFile("/api/account/avatar", photo);
      if (!uploaded.ok) {
        setPending(false);
        if (uploaded.status === 401) {
          router.push("/login?expired=1");
          router.refresh();
          return;
        }
        if (next) {
          setSaved(next);
          setDraft(draftFrom(next));
        }
        setFormError(uploaded.message);
        return;
      }
      next = parseSavedProfile(uploaded.data.profile) ?? next;
      setPhotoRevision((current) => current + 1);
    }

    setPending(false);
    if (next) {
      setSaved(next);
      setDraft(draftFrom(next));
    }
    clearPhotoChoice();
    setRemovePhoto(false);
    setSavedMessage(PROFILE_MESSAGES.saved);
    setEditing(false);
    router.refresh();
  }

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
      {formError ? (
        <p role="alert" className="mt-6 text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}

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
              <p id="profile-avatar-error" className="mt-2 text-sm text-rose-deep">
                <KnownText value={errors.avatarUrl} />
              </p>
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

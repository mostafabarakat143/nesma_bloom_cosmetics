"use client";

import { createValidation, type ProfileSchema, type AvatarFileSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useUpdateProfile, useUploadAvatar } from "@/features/account/hooks/use-account-mutations";
import { toAccountView } from "@/features/account/lib/account-view";
import {
  parseSavedProfile,
  type AccountProfile,
} from "@/features/account/lib/profile-parse";
import {
  profileUpdateError,
  type ProfileFieldErrors,
} from "@/features/account/lib/profile-update";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

const defaultValidation = createValidation();

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

export function useProfileForm({ profile, schema, avatarSchema }: { profile: AccountProfile; schema: ProfileSchema; avatarSchema: AvatarFileSchema }) {
  const router = useRouter();
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutateAsync: uploadAvatar } = useUploadAvatar();
  const t = useTranslations("account");
  const validationT = useTranslations("validation");
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
  const { error: formError, setError: setFormError, clearError, handleError } = useErrorHandler();
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
    clearError();
    setSavedMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftFrom(saved));
    clearPhotoChoice();
    setRemovePhoto(false);
    setErrors({});
    clearError();
    setEditing(false);
  }

  function choosePhoto(file: File | null) {
    clearError();
    setSavedMessage(null);
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    const parsedFile = avatarSchema.safeParse(file);
    const problem = parsedFile.success ? null : parsedFile.error.issues[0]?.message;
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
    const parsed = defaultValidation.parse(schema, {
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
    clearError();
    setPending(true);
    const result = await updateProfile(parsed.value);
    if (!result.ok) {
      setPending(false);
      handleError(result, { loginPath: "/login?expired=1" });
      return;
    }

    let next = parseSavedProfile(result.data.profile);
    if (photo) {
      const uploaded = await uploadAvatar(photo);
      if (!uploaded.ok) {
        setPending(false);
        if (handleError(uploaded, { loginPath: "/login?expired=1" })) return;
        if (next) {
          setSaved(next);
          setDraft(draftFrom(next));
        }
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
    setSavedMessage(validationT("profileSaved"));
    setEditing(false);
    router.refresh();
  }

  return {
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
  };
}

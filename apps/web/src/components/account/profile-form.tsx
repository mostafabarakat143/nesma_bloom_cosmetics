"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountAvatar } from "@/components/account/account-avatar";
import { postAuth } from "@/components/auth/post-auth";
import { TextField } from "@/components/auth/fields";
import { Button } from "@/components/ui/button";
import { toAccountView } from "@/lib/auth/account-view";
import {
  parseAvatarUrl,
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
    avatarUrl: profile.avatarUrl ?? "",
  };
}

export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter();
  const [saved, setSaved] = useState(profile);
  const [draft, setDraft] = useState(() => draftFrom(profile));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const view = toAccountView(saved.email, saved);
  const shownAvatar = editing ? parseAvatarUrl(draft.avatarUrl) : saved.avatarUrl;

  function beginEdit() {
    setDraft(draftFrom(saved));
    setErrors({});
    setFormError(null);
    setSavedMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftFrom(saved));
    setErrors({});
    setFormError(null);
    setEditing(false);
  }

  async function save() {
    const parsed = validateProfileUpdate(draft);
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
    setPending(false);

    if (!result.ok) {
      if (result.status === 401) {
        router.push("/login?expired=1");
        router.refresh();
        return;
      }
      setFormError(result.message);
      return;
    }

    const next = parseSavedProfile(result.data.profile);
    if (next) {
      setSaved(next);
      setDraft(draftFrom(next));
    }
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
          {savedMessage}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="mt-6 text-sm text-rose-deep">
          {formError}
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
            label="First name"
            autoComplete="given-name"
            value={draft.firstName}
            error={errors.firstName}
            maxLength={100}
            onChange={(firstName) => setDraft((current) => ({ ...current, firstName }))}
          />
          <TextField
            id="profile-last-name"
            label="Last name"
            autoComplete="family-name"
            value={draft.lastName}
            error={errors.lastName}
            maxLength={100}
            onChange={(lastName) => setDraft((current) => ({ ...current, lastName }))}
          />
          <TextField
            id="profile-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={saved.email}
            readOnly
            onChange={() => undefined}
          />
          <p className="-mt-3 text-sm text-muted">Email is used to log in and cannot be changed here.</p>
          <TextField
            id="profile-phone"
            label="Phone number"
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            error={errors.phone}
            maxLength={30}
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />
          <TextField
            id="profile-avatar"
            label="Profile image address"
            type="url"
            autoComplete="off"
            value={draft.avatarUrl}
            error={errors.avatarUrl}
            maxLength={2048}
            onChange={(avatarUrl) => setDraft((current) => ({ ...current, avatarUrl }))}
          />
          <p className="-mt-3 text-sm text-muted">
            Use an http or https image address, or leave this blank to show your initials.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-8">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted">First name</dt>
              <dd className="mt-1 text-ink">{saved.firstName ?? "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-muted">Last name</dt>
              <dd className="mt-1 text-ink">{saved.lastName ?? "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="mt-1 break-all text-ink">{saved.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Phone number</dt>
              <dd className="mt-1 text-ink">{saved.phone ?? "Not added yet"}</dd>
            </div>
          </dl>
          <div className="mt-8">
            <Button type="button" onClick={beginEdit}>
              Edit profile
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

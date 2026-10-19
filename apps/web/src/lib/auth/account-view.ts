export type AccountProfileName = {
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

/** Display values for the header. Identity still comes from Express `/auth/me`. */
export type AccountView = {
  email: string;
  label: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
};

function cleaned(value: string | null): string {
  return value?.trim() ?? "";
}

export function accountInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const first = cleaned(firstName);
  const last = cleaned(lastName);
  if (first && last) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? email;
  const letters = local.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "NB").toUpperCase();
}

export function toAccountView(
  email: string,
  profile: AccountProfileName | null,
): AccountView {
  const firstName = cleaned(profile?.firstName ?? null);
  const lastName = cleaned(profile?.lastName ?? null);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;
  return {
    email,
    label: firstName || email,
    fullName,
    initials: accountInitials(firstName, lastName, email),
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

import { createValidation } from "@/shared/validation";

const defaultValidation = createValidation();

export type ProfileField = "firstName" | "lastName" | "phone" | "avatarUrl";

export type ProfileFieldErrors = Partial<Record<ProfileField | "form", string>>;

export type ProfileUpdate = Partial<{
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
}>;

export function profileUpdateError(errors: ProfileFieldErrors): string {
  return errors.form ?? errors.firstName ?? errors.lastName ?? errors.phone ?? errors.avatarUrl ?? defaultValidation.message("validationFailed");
}
export function validateProfileUpdate(body: unknown) {
  return defaultValidation.parse(defaultValidation.account.profile(), body);
}

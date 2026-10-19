import { AVATAR_FILE_MESSAGES } from "@/lib/auth/avatar-file";
import { MESSAGES } from "@/lib/auth/credentials";
import { PROFILE_MESSAGES } from "@/lib/auth/profile-update";

const PRICE_INVALID =
  "Enter prices in EGP, such as 15 or 15.50. Negative values and extra decimal places are not accepted.";
const PRICE_RANGE = "Minimum price cannot be higher than maximum price.";
const PASSWORDS_MISMATCH = "The new passwords do not match.";

export const messageKeys = {
  emailRequired: "emailRequired",
  emailInvalid: "emailInvalid",
  emailTooLong: "emailTooLong",
  passwordRequired: "passwordRequired",
  passwordShort: "passwordShort",
  passwordTooLong: "passwordTooLong",
  firstNameInvalid: "firstNameInvalid",
  lastNameInvalid: "lastNameInvalid",
  resetInvalid: "resetInvalid",
  malformed: "malformed",
  rejected: "rejected",
  unavailable: "unavailable",
  sessionEnded: "sessionEnded",
  loggedOut: "loggedOut",
  revokeUnconfirmed: "revokeUnconfirmed",
  resetSuccess: "resetSuccess",
  passwordChanged: "passwordChanged",
  forgot: "forgot",
  duplicate: "duplicate",
  loginFailed: "loginFailed",
  priceInvalid: "priceInvalid",
  priceRange: "priceRange",
  passwordsMismatch: "passwordsMismatch",
  profileFirstName: "profileFirstName",
  profileLastName: "profileLastName",
  profilePhone: "profilePhone",
  profileAvatar: "profileAvatar",
  profilePhotoType: "profilePhotoType",
  profilePhotoSize: "profilePhotoSize",
  profilePhotoMissing: "profilePhotoMissing",
  profileRequired: "profileRequired",
  profileUnsupported: "profileUnsupported",
  profileSaved: "profileSaved",
  wrongCurrent: "wrongCurrent",
  currentRequired: "currentRequired",
  newRequired: "newRequired",
  confirmMismatch: "confirmMismatch",
  newDifferent: "newDifferent",
  passwordFieldsOnly: "passwordFieldsOnly",
  emptyOrder: "emptyOrder",
} as const;

export type KnownMessageKey = (typeof messageKeys)[keyof typeof messageKeys];

const byEnglish = new Map<string, KnownMessageKey>([
  [MESSAGES.emailRequired, messageKeys.emailRequired],
  [MESSAGES.emailInvalid, messageKeys.emailInvalid],
  [MESSAGES.emailTooLong, messageKeys.emailTooLong],
  [MESSAGES.passwordRequired, messageKeys.passwordRequired],
  [MESSAGES.passwordShort, messageKeys.passwordShort],
  [MESSAGES.passwordTooLong, messageKeys.passwordTooLong],
  [MESSAGES.firstNameInvalid, messageKeys.firstNameInvalid],
  [MESSAGES.lastNameInvalid, messageKeys.lastNameInvalid],
  [MESSAGES.resetInvalid, messageKeys.resetInvalid],
  [MESSAGES.malformed, messageKeys.malformed],
  [MESSAGES.rejected, messageKeys.rejected],
  [MESSAGES.unavailable, messageKeys.unavailable],
  [MESSAGES.sessionEnded, messageKeys.sessionEnded],
  [MESSAGES.loggedOut, messageKeys.loggedOut],
  [MESSAGES.revokeUnconfirmed, messageKeys.revokeUnconfirmed],
  [MESSAGES.resetSuccess, messageKeys.resetSuccess],
  [MESSAGES.passwordChanged, messageKeys.passwordChanged],
  [MESSAGES.forgot, messageKeys.forgot],
  [MESSAGES.duplicate, messageKeys.duplicate],
  [MESSAGES.loginFailed, messageKeys.loginFailed],
  [PRICE_INVALID, messageKeys.priceInvalid],
  [PRICE_RANGE, messageKeys.priceRange],
  [PASSWORDS_MISMATCH, messageKeys.passwordsMismatch],
  [PROFILE_MESSAGES.firstName, messageKeys.profileFirstName],
  [PROFILE_MESSAGES.lastName, messageKeys.profileLastName],
  [PROFILE_MESSAGES.phone, messageKeys.profilePhone],
  [PROFILE_MESSAGES.avatar, messageKeys.profileAvatar],
  [AVATAR_FILE_MESSAGES.type, messageKeys.profilePhotoType],
  [AVATAR_FILE_MESSAGES.size, messageKeys.profilePhotoSize],
  [AVATAR_FILE_MESSAGES.missing, messageKeys.profilePhotoMissing],
  [PROFILE_MESSAGES.required, messageKeys.profileRequired],
  [PROFILE_MESSAGES.unsupported, messageKeys.profileUnsupported],
  [PROFILE_MESSAGES.saved, messageKeys.profileSaved],
  ["Current password is incorrect.", messageKeys.wrongCurrent],
  ["Current password is required.", messageKeys.currentRequired],
  ["New password is required.", messageKeys.newRequired],
  ["New passwords do not match.", messageKeys.confirmMismatch],
  ["New password must be different from the current password.", messageKeys.newDifferent],
  ["Only the current and new password can be submitted.", messageKeys.passwordFieldsOnly],
  ["Your order is empty.", messageKeys.emptyOrder],
]);

export function knownMessageKey(message: string): KnownMessageKey | null {
  return byEnglish.get(message) ?? null;
}

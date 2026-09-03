/**
 * The share-link password the visitor entered (if any), held module-level so
 * deep fetchers (share_area, share_day) can attach it without prop drilling.
 * Never persisted — lives only for the page session.
 */
let password: string | null = null;

export function setSharePassword(pwd: string | null) {
  password = pwd;
}

export function getSharePassword(): string | null {
  return password;
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_FILES: string[] = [
  '/avatars/mark-01.svg',
  '/avatars/mark-02.svg',
  '/avatars/mark-03.svg',
  '/avatars/mark-04.svg',
  '/avatars/mark-05.svg',
  '/avatars/mark-06.svg',
  '/avatars/mark-07.svg',
  '/avatars/mark-08.svg',
  '/avatars/mark-09.svg',
  '/avatars/mark-10.svg',
  '/avatars/mark-11.svg',
  '/avatars/mark-12.svg',
];

export function avatarFor(address: string | null | undefined): string {
  if (!address) return AVATAR_FILES[0];
  return AVATAR_FILES[djb2(address.toLowerCase()) % AVATAR_FILES.length];
}

const lsKey = (addr: string) => `pepeAvatar_${addr.toLowerCase()}`;

export function getUserAvatar(address: string | null | undefined): string {
  if (!address) return avatarFor(address);
  try {
    return localStorage.getItem(lsKey(address)) ?? avatarFor(address);
  } catch {
    return avatarFor(address);
  }
}

export function setUserAvatar(address: string, src: string): void {
  try {
    localStorage.setItem(lsKey(address), src);
  } catch { /* localStorage unavailable */ }
}

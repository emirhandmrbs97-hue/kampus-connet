export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

export function validateFullName(v: string): string | null {
  const t = v.trim();
  if (t.length < 3) return 'Ad soyad en az 3 karakter olmalı.';
  if (!/^[\p{L}\s'.-]+$/u.test(t)) return 'Ad soyad yalnızca harf içerebilir.';
  return null;
}

export function validateUsername(v: string): string | null {
  if (!USERNAME_RE.test(v)) return '3-20 karakter; küçük harf, rakam, nokta veya alt çizgi.';
  return null;
}

export function validateEmail(v: string): string | null {
  return EMAIL_RE.test(v.trim()) ? null : 'Geçerli bir e-posta adresi gir.';
}

/** 05XXXXXXXXX, 5XXXXXXXXX veya +905XXXXXXXXX kabul edilir; 5XXXXXXXXX olarak normalize eder. */
export function normalizePhone(v: string): string | null {
  const digits = v.replace(/[\s()-]/g, '');
  const m = digits.match(/^(?:\+90|90|0)?(5\d{9})$/);
  return m ? m[1] : null;
}

export function validatePhone(v: string): string | null {
  return normalizePhone(v) ? null : 'Geçerli bir cep numarası gir (5XX XXX XX XX).';
}

export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Şifre en az 8 karakter olmalı.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Şifre en az bir harf ve bir rakam içermeli.';
  return null;
}

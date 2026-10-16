// E-posta validasyonu
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Telefon numarası validasyonu (Türkiye formatı)
export const isValidPhone = (phone: string): boolean => {
  // Türkiye telefon numarası formatı: +90 5XX XXX XX XX veya 5XX XXX XX XX
  const phoneRegex = /^(\+90|0)?5\d{2}\d{3}\d{2}\d{2}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Şifre validasyonu (en az 8 karakter)
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

// Kullanıcı adı validasyonu (alfanumerik, alt çizgi, tire, 3-20 karakter)
export const isValidUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

// Ad soyad validasyonu (en az 2 karakter, sadece harf ve boşluk)
export const isValidName = (name: string): boolean => {
  const nameRegex = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]{2,}$/;
  return nameRegex.test(name) && name.trim().length >= 2;
};

// URL validasyonu
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Kayıt formu validasyonu
export interface RegisterFormData {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const validateRegisterForm = (data: RegisterFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!isValidName(data.fullName)) {
    errors.push({ field: 'fullName', message: 'Ad soyad en az 2 karakter olmalı' });
  }

  if (!isValidUsername(data.username)) {
    errors.push({ field: 'username', message: 'Kullanıcı adı 3-20 karakter, sadece harf, rakam, _ ve - içerebilir' });
  }

  if (!isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Geçerli bir e-posta adresi girin' });
  }

  if (!isValidPhone(data.phone)) {
    errors.push({ field: 'phone', message: 'Geçerli bir telefon numarası girin' });
  }

  if (!isValidPassword(data.password)) {
    errors.push({ field: 'password', message: 'Şifre en az 8 karakter olmalı' });
  }

  if (data.password !== data.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Şifreler eşleşmiyor' });
  }

  return errors;
};

// Giriş formu validasyonu
export interface LoginFormData {
  email: string;
  password: string;
}

export const validateLoginForm = (data: LoginFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Geçerli bir e-posta adresi girin' });
  }

  if (!data.password) {
    errors.push({ field: 'password', message: 'Şifre gerekli' });
  }

  return errors;
};

// Şifre değiştirme validasyonu
export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const validateChangePasswordForm = (data: ChangePasswordFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.currentPassword) {
    errors.push({ field: 'currentPassword', message: 'Mevcut şifre gerekli' });
  }

  if (!isValidPassword(data.newPassword)) {
    errors.push({ field: 'newPassword', message: 'Yeni şifre en az 8 karakter olmalı' });
  }

  if (data.newPassword !== data.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Şifreler eşleşmiyor' });
  }

  if (data.currentPassword === data.newPassword) {
    errors.push({ field: 'newPassword', message: 'Yeni şifre mevcut şifreden farklı olmalı' });
  }

  return errors;
};

// Kullanıcı adı değiştirme validasyonu
export const validateUsernameChange = (username: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!isValidUsername(username)) {
    errors.push({ field: 'username', message: 'Kullanıcı adı 3-20 karakter, sadece harf, rakam, _ ve - içerebilir' });
  }

  return errors;
};

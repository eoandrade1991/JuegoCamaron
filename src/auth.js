import { UserStorage, AdminStorage } from './storage.js';

export class AuthManager {
  constructor(onAuthChange) {
    this.onAuthChange = onAuthChange || (() => {});
    this.currentRole = 'guest'; // 'guest', 'player', 'admin'
    this.playerData = null;

    this.checkInitialSession();
  }

  checkInitialSession() {
    const session = UserStorage.getCurrentSession();
    if (session) {
      this.currentRole = 'player';
      this.playerData = session;
    } else {
      this.currentRole = 'guest';
      this.playerData = null;
    }
  }

  getRole() {
    return this.currentRole;
  }

  getPlayer() {
    return this.playerData;
  }

  loginUser(identifier, password) {
    if (!identifier || !identifier.trim()) {
      throw new Error('Ingresa tu usuario, correo electrónico o cédula.');
    }
    if (!password || !password.trim()) {
      throw new Error('Ingresa tu contraseña.');
    }

    const user = UserStorage.loginUser(identifier, password);
    this.playerData = user;
    this.currentRole = 'player';
    this.onAuthChange(this.currentRole, this.playerData);
    return user;
  }

  registerUser(formData) {
    const { username, password, fullName, cedula, email, birthDate } = formData;

    if (!username || username.trim().length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
    }
    if (!password || password.trim().length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres.');
    }
    if (!fullName || fullName.trim().length < 3) {
      throw new Error('Por favor, ingresa tus nombres y apellidos completos.');
    }
    if (!cedula || cedula.trim().length < 5) {
      throw new Error('Por favor, ingresa un número de cédula o identificación válido.');
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      throw new Error('Por favor, ingresa un correo electrónico válido.');
    }
    if (!birthDate) {
      throw new Error('Por favor, selecciona tu fecha de nacimiento.');
    }

    const user = UserStorage.registerUser({
      username: username.trim(),
      password: password.trim(),
      fullName: fullName.trim(),
      cedula: cedula.trim(),
      email: email.trim().toLowerCase(),
      birthDate: birthDate
    });

    this.playerData = user;
    this.currentRole = 'player';
    this.onAuthChange(this.currentRole, this.playerData);
    return user;
  }

  // Alias retrocompatible
  registerPlayer(formData) {
    return this.registerUser(formData);
  }

  loginAdmin(password) {
    if (!password) {
      throw new Error('Ingresa la contraseña de administrador.');
    }
    if (!AdminStorage.verifyPassword(password)) {
      throw new Error('Contraseña incorrecta. (Clave por defecto: admin123)');
    }

    this.currentRole = 'admin';
    this.onAuthChange(this.currentRole, null);
    return true;
  }

  logout() {
    UserStorage.clearSession();
    this.playerData = null;
    this.currentRole = 'guest';
    this.onAuthChange(this.currentRole, null);
  }

  exitAdminMode() {
    const session = UserStorage.getCurrentSession();
    if (session) {
      this.currentRole = 'player';
      this.playerData = session;
    } else {
      this.currentRole = 'guest';
      this.playerData = null;
    }
    this.onAuthChange(this.currentRole, this.playerData);
  }
}


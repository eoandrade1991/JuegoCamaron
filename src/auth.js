import { PlayerStorage, AdminStorage } from './storage.js';

export class AuthManager {
  constructor(onAuthChange) {
    this.onAuthChange = onAuthChange || (() => {});
    this.currentRole = 'guest'; // 'guest', 'player', 'admin'
    this.playerData = null;

    this.checkInitialSession();
  }

  checkInitialSession() {
    const savedPlayer = PlayerStorage.getPlayer();
    if (savedPlayer) {
      this.currentRole = 'player';
      this.playerData = savedPlayer;
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

  registerPlayer(formData) {
    const { fullName, cedula, email, birthDate } = formData;

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

    const player = {
      fullName: fullName.trim(),
      cedula: cedula.trim(),
      email: email.trim().toLowerCase(),
      birthDate: birthDate,
      registeredAt: Date.now()
    };

    PlayerStorage.savePlayer(player);
    this.playerData = player;
    this.currentRole = 'player';
    this.onAuthChange(this.currentRole, this.playerData);
    return player;
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
    PlayerStorage.clearPlayer();
    this.playerData = null;
    this.currentRole = 'guest';
    this.onAuthChange(this.currentRole, null);
  }

  exitAdminMode() {
    const savedPlayer = PlayerStorage.getPlayer();
    if (savedPlayer) {
      this.currentRole = 'player';
      this.playerData = savedPlayer;
    } else {
      this.currentRole = 'guest';
      this.playerData = null;
    }
    this.onAuthChange(this.currentRole, this.playerData);
  }
}

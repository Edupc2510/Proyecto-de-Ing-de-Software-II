// models/userModel.js
// Manejo de persistencia de usuarios usando el sistema de archivos local (JSON)

const fs = require('fs');
const path = require('path');
//const usersFilePath = path.join(__dirname, '../../data/users.json');
const DATA_PATH = path.join(__dirname, '../../data/users.json');
/**
 * Lee todos los usuarios desde el archivo JSON.
 * Si el archivo no existe o está vacío, retorna un array vacío.
 * @returns {Array} Lista de usuarios
 */
function readUsers() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify([]), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    if (!raw || raw.trim() === '') return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error('[UserModel] Error leyendo users.json:', error.message);
    return [];
  }
}

/**
 * Escribe el array completo de usuarios en el archivo JSON.
 * @param {Array} users - Lista de usuarios a persistir
 * @returns {boolean} true si se guardó correctamente
 */
function writeUsers(users) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[UserModel] Error escribiendo users.json:', error.message);
    return false;
  }
}

/**
 * Busca un usuario por correo electrónico.
 * @param {string} email
 * @returns {Object|null} Usuario encontrado o null
 */
function findUserByEmail(email) {
  const users = readUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Busca un usuario por su ID único.
 * @param {string} id
 * @returns {Object|null}
 */
function findUserById(id) {
  const users = readUsers();
  return users.find(u => u.id === id) || null;
}

/**
 * Crea un nuevo usuario y lo agrega al archivo JSON.
 * @param {Object} userData - Datos del nuevo usuario
 * @returns {Object} El usuario creado
 */
function createUser(userData) {
  const users = readUsers();
  users.push(userData);
  writeUsers(users);
  return userData;
}

/**
 * Actualiza un usuario existente identificado por su ID.
 * @param {string} id - ID del usuario a actualizar
 * @param {Object} updates - Campos a actualizar
 * @returns {Object|null} El usuario actualizado o null si no se encontró
 */
function updateUser(id, updates) {
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  writeUsers(users);
  return users[index];
}

module.exports = {
  readUsers,
  writeUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
};

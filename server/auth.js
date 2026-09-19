const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Fail-fast: refuse to start without production keys
if (!process.env.JWT_SECRET || !process.env.ENCRYPTION_KEY) {
  console.error('FATAL: JWT_SECRET or ENCRYPTION_KEY environment variable is missing.');
  console.error('The server must be started with production-grade credentials.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'antum-people-dev-secret-keep-safe';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'antum-people-enc-key-32chars-low'; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * JWT Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

/**
 * Encrypts text using AES-256-GCM
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption error:', err);
    throw new Error('Encryption failed'); // Ensure we never silently persist plaintext
  }
}

/**
 * Decrypts text using AES-256-GCM
 */
function decrypt(encryptedData) {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData; // Not encrypted in our format

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    // If decryption fails, it might be plaintext or wrong key
    // console.error('Decryption error:', err);
    return encryptedData;
  }
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  encrypt,
  decrypt,
  hashPassword: (password) => bcrypt.hash(password, 10),
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  generateToken: (user) => jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  )
};

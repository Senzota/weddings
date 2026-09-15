const { customAlphabet } = require('nanoid');

// No ambiguous characters (0/O, 1/I) — guests read these off a phone screen.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const generatePasscode = customAlphabet(ALPHABET, 8);

module.exports = { generatePasscode };

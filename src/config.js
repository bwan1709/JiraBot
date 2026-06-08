const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'jirabot.db');
// Vite builds the React app into ../dist; Express serves it as the web root.
const PUBLIC_DIR = path.join(__dirname, '..', 'dist');

module.exports = {
    PORT,
    DATA_DIR,
    DB_PATH,
    PUBLIC_DIR
};

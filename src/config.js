const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'jirabot.db');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

module.exports = {
    PORT,
    DATA_DIR,
    DB_PATH,
    PUBLIC_DIR
};

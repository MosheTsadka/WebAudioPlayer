const path = require('path');

const DEFAULT_LIBRARY_ROOT = path.resolve(process.cwd(), 'library');
const DEFAULT_PORT = 4000;

const libraryRoot = process.env.LIBRARY_ROOT && process.env.LIBRARY_ROOT.trim()
  ? process.env.LIBRARY_ROOT
  : DEFAULT_LIBRARY_ROOT;

const portEnv = process.env.PORT;
const port = portEnv && !Number.isNaN(Number(portEnv))
  ? Number(portEnv)
  : DEFAULT_PORT;

module.exports = {
  libraryRoot,
  port,
};

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// setup for json import
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "./config/sessions.json");

// Functions
const getSessionType = async () => {
  const data = await readFile(configPath, "utf-8");

  const config = JSON.parse(data);

  // Return config keys, not DB values
  return Object.keys(config);
};


export { getSessionType };
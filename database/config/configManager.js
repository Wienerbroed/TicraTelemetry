import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Hardcoded Query files
const jsonFiles = {
    queries: "queries.json",
    sessions: "sessions.json"
};


// Hardcoded schemas for query files
const jsonSchemas = {
    queries: (title, eventType, payloadPath) => ({
        [title]: {
            query: { event_type: eventType },
            fields: assignNested({}, payloadPath, 1, {
                _id: 0,
                event_type: 1,
                time_stamp: 1,
                user_name: 1,
                employee_type: 1
            })
        }
    }),
    sessions: (title, eventType, payloadPath) => ({
        [title]: {
            query: { event_type: eventType },
            fields: assignNested({}, payloadPath, 1, {
                _id: 0,
                time_stamp: 1,
                user_name: 1,
                event_number: 1,
                session_id: 1
            })
        }
    })
};


// Makes sure payload is stored as payload.(input)
function assignNested(obj, path, value, baseFields = {}) {
  if (!path) return { ...baseFields, ...obj };

  // Store the path as a flat key
  obj[path] = value;

  // Merge with base fields
  return { ...baseFields, ...obj };
}



async function appendJson(fileKey, title, eventType, payloadPath) {
    try {
        if (!jsonFiles[fileKey]) throw new Error("Invalid file key");
        if (!jsonSchemas[fileKey]) throw new Error("No schema defined for this file");

        const filePath = join(__dirname, jsonFiles[fileKey]);
        let myObject = {};
        try {
            const data = await fs.readFile(filePath, "utf8");
            if (data.trim()) myObject = JSON.parse(data);
        } catch {}

        const newData = jsonSchemas[fileKey](title, eventType, payloadPath);
        const baseKey = Object.keys(newData)[0];
        let newKey = baseKey;
        let counter = 1;
        while (Object.prototype.hasOwnProperty.call(myObject, newKey)) {
            newKey = `${baseKey}_${counter}`;
            counter++;
        }
        myObject[newKey] = newData[baseKey];
        await fs.writeFile(filePath, JSON.stringify(myObject, null, 2), "utf8");
        console.log(`${jsonFiles[fileKey]} updated successfully!`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}



async function updateJson(fileKey, keyToUpdate, newTitle, newEventType, newPayloadPath) {
    try {
        if (!jsonFiles[fileKey]) throw new Error("Invalid file key");
        if (!jsonSchemas[fileKey]) throw new Error("No schema defined for this file");

        const filePath = join(__dirname, jsonFiles[fileKey]);
        const data = await fs.readFile(filePath, "utf8");
        const myObject = data.trim() ? JSON.parse(data) : {};
        if (!myObject[keyToUpdate]) throw new Error(`Key "${keyToUpdate}" not found`);

        const newData = jsonSchemas[fileKey](newTitle, newEventType, newPayloadPath);
        delete myObject[keyToUpdate];

        const baseKey = Object.keys(newData)[0];
        let newKey = baseKey;
        let counter = 1;
        while (Object.prototype.hasOwnProperty.call(myObject, newKey)) {
            newKey = `${baseKey}_${counter}`;
            counter++;
        }

        myObject[newKey] = newData[baseKey];
        await fs.writeFile(filePath, JSON.stringify(myObject, null, 2), "utf8");
        console.log(`${jsonFiles[fileKey]} key "${keyToUpdate}" updated successfully!`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}



async function deleteJson(fileKey, keyToDelete) {
    try {
        if (!jsonFiles[fileKey]) throw new Error("Invalid file key");

        const filePath = join(__dirname, jsonFiles[fileKey]);
        const data = await fs.readFile(filePath, "utf8");
        const myObject = data.trim() ? JSON.parse(data) : {};

        if (!myObject[keyToDelete]) throw new Error(`Key "${keyToDelete}" not found`);
        delete myObject[keyToDelete];

        await fs.writeFile(filePath, JSON.stringify(myObject, null, 2), "utf8");
        console.log(`${jsonFiles[fileKey]} key "${keyToDelete}" deleted successfully!`);
    } catch (err) {
        console.error("Error:", err.message);
    }
}




export { appendJson, updateJson, deleteJson };

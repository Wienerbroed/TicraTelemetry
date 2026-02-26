import { connectConfigDB } from "./db.js";

const COLLECTION = "config";

// Validate mode
const validateMode = (mode) => {
  if (!["session", "event"].includes(mode)) {
    throw new Error("Mode must be either 'session' or 'event'");
  }
};

// Validate required fields
const validateRequiredFields = ({ title, mode, event_type, payload_field, description }) => {
  if (!title) throw new Error("title is required");
  if (!mode) throw new Error("mode is required");
  if (!event_type) throw new Error("event_type is required");
  if (!payload_field) throw new Error("payload_field is required");
  if (description && description.length > 200) throw new Error("Description cannot exceed 200 characters");
  validateMode(mode);
};

// Create a new config
const createConfig = async ({ title, mode, event_type, payload_field, description, extra_query = {} }) => {
  validateRequiredFields({ title, mode, event_type, payload_field, description });

  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);

  const existing = await collection.findOne({ title });
  if (existing) throw new Error("Config with this title already exists");

  const configDoc = {
    title,
    mode,
    event_type,
    payload_field,
    description: description || "",
    extra_query,
    created_at: new Date(),
    updated_at: new Date()
  };

  await collection.insertOne(configDoc);
  return configDoc;
};

// Build query from config
const buildQueryFromConfig = (config) => {
  const baseQuery = { event_type: config.event_type, ...config.extra_query };

  const fields = { _id: 0, time_stamp: 1, user_name: 1 };

  if (config.mode === "session") {
    fields.event_number = 1;
    fields.session_id = 1;
  }

  if (config.mode === "event") {
    fields.employee_type = 1;
  }

  fields[`payload.${config.payload_field}`] = 1;

  return { [config.title]: { query: baseQuery, fields, description: config.description } };
};

// Get query for a config
const getConfigQuery = async (title) => {
  if (!title) throw new Error("title is required");

  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);

  const config = await collection.findOne({ title });
  if (!config) throw new Error("Config not found");

  return buildQueryFromConfig(config);
};

// Get raw config
const getRawConfig = async (title) => {
  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);
  return await collection.findOne({ title }, { projection: { _id: 0 } });
};

// List all configs
const listConfigs = async () => {
  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);
  return await collection.find({}, { projection: { _id: 0 } }).toArray();
};

// Update config
const updateConfig = async (oldTitle, updates) => {
  if (!oldTitle) throw new Error("title is required");

  const allowedFields = ["title", "mode", "event_type", "payload_field", "extra_query", "description"];
  const filteredUpdates = {};

  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      if (key === "mode") validateMode(updates[key]);
      if (key === "description" && updates[key].length > 200) {
        throw new Error("Description cannot exceed 200 characters");
      }
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw new Error("No valid fields provided for update");
  }

  filteredUpdates.updated_at = new Date();

  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);

  const result = await collection.updateOne({ title: oldTitle }, { $set: filteredUpdates });
  if (result.matchedCount === 0) throw new Error("Config not found");

  return { success: true };
};

// Delete config
const deleteConfig = async (title) => {
  if (!title) throw new Error("title is required");

  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);

  const result = await collection.deleteOne({ title });
  if (result.deletedCount === 0) throw new Error("Config not found");

  return { success: true };
};


export { createConfig, getConfigQuery, getRawConfig, listConfigs, updateConfig, deleteConfig };


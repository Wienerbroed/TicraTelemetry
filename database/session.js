import { connectConfigDB } from "./db.js";

const COLLECTION = "config";

const getSessionType = async () => {
  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);

  // Fetch only configs where mode = "event"
  const configs = await collection
    .find(
      { mode: "session" },
      { projection: { _id: 0, title: 1 } }
    )
    .toArray();

  return configs.map(config => config.title);
};

export { getSessionType };

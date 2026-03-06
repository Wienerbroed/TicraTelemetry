import { connectConfigDB } from "./db.js";

const COLLECTION = "config";

const getEventQueries = async () => {
  const db = await connectConfigDB();
  const collection = db.collection(COLLECTION);


  const configs = await collection
    .find(
      { mode: "event" },
      { projection: { _id: 0, title: 1 } }
    )
    .toArray();

  return configs.map(config => config.title);
};

export { getEventQueries };

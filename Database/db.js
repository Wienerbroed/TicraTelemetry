//////////////////////////////////////////// Imports ////////////////////////////////////////////
import e from 'express';
import { MongoClient } from 'mongodb';


// Enviromental variables
const username = encodeURIComponent(process.env.MONGO_USER);
const password = encodeURIComponent(process.env.MONGO_PASSWORD);
const dbUrl = encodeURIComponent(process.env.MONGODB_URL);


// Database URL
const uri = `mongodb+srv://${username}:${password}@${dbUrl}/?retryWrites=true&w=majority`;


// Attributes
let client;
let db;


// Connect to Mongodb
const connectDB = async () => {
  if (db) {
    return db;
  }

  try {
    // Set client to database
    client = new MongoClient(uri);

    // Check connction
    await client.connect();

    // Sets db
    db = client.db('gui_event_db');
    console.log('MongoDB Atlas connected');

    // Return db
    return db;

    // Error catch
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};


// Exports
export { connectDB };

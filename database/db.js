import { MongoClient } from 'mongodb';

// Environmental variables
const username = encodeURIComponent(process.env.MONGO_USER);
const writeUsername = encodeURIComponent(process.env.MONGO_WRITE_USER);
const password = encodeURIComponent(process.env.MONGO_PASSWORD);
const writePassword = encodeURIComponent(process.env.MONGO_WRITE_PASSWORD);
const dbUrl = encodeURIComponent(process.env.MONGODB_URL);

// Database URLs
const uri = `mongodb+srv://${username}:${password}@${dbUrl}/?retryWrites=true&w=majority`;
const writeUrl = `mongodb+srv://${writeUsername}:${writePassword}@${dbUrl}/?retryWrites=true&w=majority`;

// Separate clients and DB instances
let readClient;
let readDB;

let writeClient;
let writeDB;

// ================= READ CONNECTION =================
const connectDB = async () => {
  if (readDB) return readDB;

  try {
    readClient = new MongoClient(uri);
    await readClient.connect();
    readDB = readClient.db('gui_event_db');

    console.log('✅ Read DB connected');
    return readDB;
  } catch (err) {
    console.error('❌ Read DB connection failed:', err.message);
    process.exit(1);
  }
};

const connectTestDb = async () => {
  if(readDB) return readDB;

  try {
    readClient = new MongoClient(uri);
    await readClient.connect();
    readDB = readClient.db('tst_gui_event_db');

    console.log('✅ Read DB connected');
    return readDB;
  } catch (err) {
    console.error('❌ Read DB connection failed:', err.message);
    process.exit(1);
  }
};


// ================= WRITE CONNECTION =================
const connectConfigDB = async () => {
  if (writeDB) return writeDB;

  try {
    writeClient = new MongoClient(writeUrl);
    await writeClient.connect();
    writeDB = writeClient.db('gui_event_db');

    console.log('✅ Write DB connected');
    return writeDB;
  } catch (err) {
    console.error('❌ Write DB connection failed:', err.message);
    process.exit(1);
  }
};


const connectTestConfigDB = async () => {
  if (writeDB) return writeDB;

  try {
    writeClient = new MongoClient(writeUrl);
    await writeClient.connect();
    writeDB = writeClient.db('tst_gui_event_db');

    console.log('✅ Write DB connected');
    return writeDB;
  } catch (err) {
    console.error('❌ Write DB connection failed:', err.message);
    process.exit(1);
  }
};


// ================= FILTERS =================
const timeIntervalFilter = (start, end) => {
  if (!start && !end) return {};

  const filter = {};
  if (start) filter.$gte = start;
  if (end) filter.$lte = end;

  return { time_stamp: filter };
};

const employeeTypeFilter = employeeType => {
  if (!employeeType) return {};
  return { employee_type: employeeType };
};

export {
  connectDB,
  connectConfigDB,
  timeIntervalFilter,
  employeeTypeFilter
};

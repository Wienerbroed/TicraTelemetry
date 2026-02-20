import { connectDB } from "./db.js";

// Set attribute for connected database
const database = await connectDB();


// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


// Array to store uniqu users
const userList = [];
const employeeTypeList = [];


// Functions
const getUsers = async () => {
  try {
    // Fetch unique users
    const distinctUsers = await eventTypeCollection.distinct('user_name');

    // Add users to array
    userList.push(...distinctUsers);

    return userList;

  } catch (err) {
    console.error('No users found', err.message);
    throw err;
  }
}

const getEmployeeTypes = async () => {
  try {
    const types = await eventTypeCollection
      .distinct("employee_type");

    return types.filter(Boolean).sort();
  } catch (err) {
    console.error("Error fetching employee types:", err);
    throw err;
  }
};


export { getUsers, getEmployeeTypes };
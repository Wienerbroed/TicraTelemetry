import { connectDB } from "./db.js";

// Set attribute for connected database
const database = await connectDB();


// Sets collection from database
const eventTypeCollection = database.collection('gui_event');


// Array to store uniqu users
const userList = [];


// Fetch users
const getUsers = async () => {
  try {
    // Fetch unique users
    const distinctUsers = await eventTypeCollection.distinct('user_name');

    // Add users to array
    userList.push(...distinctUsers);

    return userList;

    // Error catch
  } catch (err) {
    console.error('No users found', err.message);
    throw err;
  }
}


//count users
const userInteractionCount = async () => {
  try {
    // Load users in db
    const userage = await getUsers();

    // Sets user attributes
    const users = await eventTypeCollection
      .find({}, {projection: {user_name: 1}})
      .toArray();
    
      // Counter
      const counts = {};

      // stets user start count for users
      userage.forEach(user=> counts[user] = 0);

      // foreach to count users 
      users.forEach(user => {
        counts[user.user_name]++;
      });

      return counts;

  } catch (err) {
    console.error('No users found');
    throw err;
  }
}


// get payload data by users
const actionsByUsers = async () => {
  try {
    const result = await eventTypeCollection.aggregate([
      {
        // Remove unwanted keys from payload BEFORE grouping
        $addFields: {
          normalizedPayload: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: "$payload" },
                as: "item",
                cond: {
                  $and: [
                    { $not: { $in: ["$$item.k", ["className", "object", "Application Title", "classname"]] } },
                    { $ne: [{ $type: "$$item.v" }, "object"] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            user_name: "$user_name",
            payload: "$normalizedPayload"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.user_name",
          payloads: {
            $push: {
              payload: "$_id.payload",
              count: "$count"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          event_type: "$_id",
          payloads: 1
        }
      }
    ]).toArray();

    return result;
  } catch (err) {
    console.error("No payload found");
    throw err;
  }
};


// Exports
export { getUsers, actionsByUsers, userInteractionCount };
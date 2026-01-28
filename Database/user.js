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
        // Remove unwanted keys from payload before grouping
        $addFields: {
          normalizedPayload: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: "$payload" },
                as: "item",
                cond: {
                  $and: [
                    { $not: { $in: ["$$item.k", ["className", "object", "Application Title", "classname", "name"]] } },
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


// Calculates time spent on eventtype for each user
const userTimeExpenditureByPayload = async () => {
  try {
    // Fetch events sorted by user and timestamp
    const events = await eventTypeCollection
      .find({ user_name: { $exists: true } }, {
        projection: {
          _id: 0,
          user_name: 1,
          event_type: 1,
          payload: 1,
          time_stamp: 1,
          event_number: 1
        }
      })
      .sort({ user_name: 1, time_stamp: 1, event_number: 1 })
      .toArray();

    const result = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const next = events[i + 1];

      let time_spent = null;

      if (next && event.user_name === next.user_name) {
        const currTime = new Date(event.time_stamp).getTime();
        const nextTime = new Date(next.time_stamp).getTime();

        // Calculate minutes difference
        time_spent = (nextTime - currTime) / 60000;

        // If next event number < current and timestamps differ => session ended
        if (next.event_number < event.event_number && nextTime !== currTime) {
          time_spent = "session ended";
        }
      } else {
        // Last event for this user
        time_spent = "session ended";
      }

      result.push({
        user_name: event.user_name ?? "unknown",
        event_type: event.event_type ?? "unknown",
        event_number: event.event_number ?? null,
        payload: event.payload ?? {},
        time_stamp: event.time_stamp ?? null,
        time_spent
      });
    }

    return result;
  } catch (err) {
    console.error("Error fetching user time expenditure", err);
    return [];
  }
};


// Exports
export { getUsers, actionsByUsers, userInteractionCount, userTimeExpenditureByPayload };
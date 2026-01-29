import { connectDB } from "./db.js";

// Set attribute for database
const database = await connectDB();

// Set collection to fetch data from in database
const dbCollection = database.collection('gui_event');


// Fetch and pool data 
const timeSpendByEventType = async () => {
    try {
        const events = await dbCollection
            .find(
                { user_name: { $exists: true } },
                {
                    projection: {
                        _id: 0,
                        user_name: 1,
                        event_type: 1,
                        time_stamp: 1,
                        event_number: 1
                    }
                }
            )
            .sort({ user_name: 1, time_stamp: 1, event_number: 1 })
            .toArray();

        const perUser = {};
        const pooled = {};

        for (let i = 0; i < events.length; i++) {
            const curr = events[i];
            const next = events[i + 1];

            let time_spent = 0;

            if (next && curr.user_name === next.user_name) {
                const currTime = new Date(curr.time_stamp).getTime();
                const nextTime = new Date(next.time_stamp).getTime();

                if (
                    nextTime > currTime &&
                    next.event_number >= curr.event_number
                ) {
                    time_spent = (nextTime - currTime) / 60000;
                }
            }

            const eventType = curr.event_type ?? "unknown";
            const user = curr.user_name;

            // ---------- per-user ----------
            if (!perUser[user]) perUser[user] = [];
            perUser[user].push({
                event_type: eventType,
                time_spent
            });

            // ---------- pooled averages ----------
            if (!pooled[eventType]) {
                pooled[eventType] = {
                    total_time: 0,
                    users: new Set()
                };
            }

            pooled[eventType].total_time += time_spent;
            pooled[eventType].users.add(user);
        }

        const averages = Object.entries(pooled).map(
            ([event_type, data]) => ({
                event_type,
                avg_time_spent:
                    data.users.size === 0
                        ? 0
                        : data.total_time / data.users.size
            })
        );

        return { perUser, averages };

    } catch (err) {
        console.error("Error calculating time spent:", err);
        throw err;
    }
};


// Pool Create usage
const clicksByOperation = async () => {
    try {
        // 1️⃣ Fetch all Create events with operation
        const events = await dbCollection
            .find(
                { event_type: "Create", "payload.operation": { $exists: true } },
                {
                    projection: {
                        _id: 0,
                        user_name: 1,
                        "payload.operation": 1
                    }
                }
            )
            .sort({ user_name: 1 }) // sort by user for consistency
            .toArray();


        const perUser = {}; // { user: [ { operation, clicks } ] }
        const pooled = {};  // { operation: { total_clicks, users: Set() } }

        for (let i = 0; i < events.length; i++) {
            const curr = events[i];
            const user = curr.user_name ?? "unknown";
            const operation = curr.payload.operation ?? "unknown";

            // ---------- per-user ----------
            if (!perUser[user]) perUser[user] = [];
            const opIndex = perUser[user].findIndex(o => o.operation === operation);
            if (opIndex >= 0) {
                perUser[user][opIndex].clicks += 1;
            } else {
                perUser[user].push({ operation, clicks: 1 });
            }

            // ---------- pooled totals ----------
            if (!pooled[operation]) {
                pooled[operation] = { total_clicks: 0, users: new Set() };
            }
            pooled[operation].total_clicks += 1;
            pooled[operation].users.add(user);
        }

        // ---------- compute averages ----------
        const averages = Object.entries(pooled).map(([operation, data]) => ({
            operation,
            avg_clicks_per_user: data.users.size === 0
                ? 0
                : data.total_clicks / data.users.size
        }));


        return { perUser, averages };

    } catch (err) {
        console.error("Error calculating clicks:", err);
        throw err;
    }
};


// Pool GraspUiStart by objectsExplorerSelection




export { timeSpendByEventType, clicksByOperation };
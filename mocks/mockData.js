// Data for mockdb used in testing
const mockEvents = [
  {
    user_name: "Adrian Hobson",
    event_type: "Create",
    payload: { operation: "new menu" },
    time_stamp: "2026-02-03T09:00:00Z",
    event_number: 1,
    employee_type: "full-time"
  },
  {
    user_name: "Adrian Hobson",
    event_type: "Create",
    payload: { operation: "edit menu" },
    time_stamp: "2026-02-03T09:01:03Z",
    event_number: 2,
    employee_type: "full-time"
  },
  {
    user_name: "Adrian Hobson",
    event_type: "GraspGUI Start",
    payload: { objectsExplorerSelection: "elementA" },
    time_stamp: "2026-02-03T09:03:33Z",
    event_number: 3,
    employee_type: "full-time"
  }
]
;


export { mockEvents };

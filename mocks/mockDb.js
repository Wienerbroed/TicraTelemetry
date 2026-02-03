const getByPath = (obj, path) =>
  path.split(".").reduce((acc, key) => acc?.[key], obj);

const matchesQuery = (doc, query = {}) =>
  Object.entries(query).every(([key, condition]) => {
    const value = getByPath(doc, key);

    if (typeof condition === "object" && condition !== null) {
      if ("$exists" in condition) return condition.$exists ? value !== undefined : value === undefined;
      return false;
    }
    return value === condition;
  });

export const createMockDb = (data = []) => ({
  find(query = {}) {
    const filtered = data.filter(doc => matchesQuery(doc, query));

    return {
      sort() {
        return {
          async toArray() {
            return filtered;
          }
        };
      },
      async toArray() {
        return filtered;
      }
    };
  }
});



export const TestUsers = [...Array(10).keys()].map((i) => ({
  name: `user${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: `password${i + 1}`,
}));

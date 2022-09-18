export const TestUsers = [...Array(10).keys()].map((i) => ({
  name: `user${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: `password${i + 1}`,
}));

export const profilePic =
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=250&h=250&dpr=2';

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { faker } from "@faker-js/faker";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateUser = () => {
  const sex = faker.person.sex() as "female" | "male";
  const fullName = faker.person.fullName({ sex });
  const [firstName, lastName] = fullName.split(" ");
  const email = faker.internet.email({ firstName, lastName });
  const avatar = faker.image.avatar();
  return { firstName, lastName, fullName, email, avatar };
};

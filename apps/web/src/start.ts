import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [authkitMiddleware()],
}));

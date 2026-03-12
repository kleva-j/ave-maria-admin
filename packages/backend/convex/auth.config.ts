import { auth } from "./auth";

export default {
  providers: auth.getAuthConfigProviders(),
};

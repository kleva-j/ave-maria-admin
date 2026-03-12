import { AuthKit } from "@convex-dev/workos-authkit";

import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";

export const auth = new AuthKit<DataModel>(components.workOSAuthKit);

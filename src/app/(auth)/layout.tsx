import type { PropsWithChildren } from "react";

export default function AuthLayout({ children }: PropsWithChildren) {
  return <main className="grid place-items-center pt-4 h-4/5">{children}</main>;
}

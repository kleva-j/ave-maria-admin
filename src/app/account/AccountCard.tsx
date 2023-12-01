import type { PropsWithChildren } from "react";

import { Card } from "@/components/ui/card";

interface AccountCardProps extends PropsWithChildren {
  params: {
    header: string;
    description: string;
    price?: number;
  };
}

export function AccountCard({ params, children }: AccountCardProps) {
  const { header, description } = params;
  return (
    <Card>
      <div id="body" className="p-4 ">
        <h3 className="text-xl font-semibold">{header}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export function AccountCardBody({ children }: PropsWithChildren) {
  return <div className="p-4">{children}</div>;
}

type AccountCardFooterProps = PropsWithChildren & { description: string };

export function AccountCardFooter(props: AccountCardFooterProps) {
  const { description, children } = props;
  return (
    <div
      className="flex items-center justify-between border border-zinc-200 bg-primary-foreground p-4 dark:border-slate-800 dark:bg-slate-900"
      id="footer"
    >
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

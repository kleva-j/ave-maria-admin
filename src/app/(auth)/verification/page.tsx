"use client";

import { EmailLinkErrorCode, isEmailLinkError, useClerk } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { getBaseUrl } from "@/trpc/shared";

import Link from "next/link";

const { log } = console;

export default function UserVerification() {
  const [status, setStatus] = useState("loading");
  const { handleEmailLinkVerification } = useClerk();

  useEffect(() => {
    async function verify() {
      try {
        await handleEmailLinkVerification({
          redirectUrl: `${getBaseUrl()}/dashboard`,
          redirectUrlComplete: `${getBaseUrl()}/dashboard`,
        });
        setStatus("verified");
      } catch (err: unknown) {
        const error = err as Error;
        let status = "failed";
        if (
          isEmailLinkError(error) &&
          error.code === EmailLinkErrorCode.Expired
        )
          status = "expired";
        setStatus(status);
      }
    }
    verify().then(log).catch(log);
  }, []);

  if (status === "loading") return <div>Loading...</div>;
  if (status === "expired") return <div>Magic link expired</div>;
  if (status === "failed") return <div>Magic link verification failed</div>;

  return (
    <div className="p-4">
      Successfully Verified. Click <Link href="/dashboard">here</Link> if not
      redirected automatically.
    </div>
  );
}

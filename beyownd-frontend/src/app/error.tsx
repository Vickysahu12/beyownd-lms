"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { StatusPage } from "@/components/marketing/status-page";
import { buttonVariants } from "@/components/ui/button";

/* Route-level error boundary. Never shows the stack trace; offers a retry. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main">
      <StatusPage
        icon={Alert02Icon}
        tint="bg-peach text-[#8a3b12]"
        title="Something went wrong"
        body={<>Please try again. If it keeps happening, email <a className="underline underline-offset-4" href="mailto:hello@beyownd.in">hello@beyownd.in</a>{error.digest ? <> with code <span className="font-mono text-[14px]">{error.digest}</span></> : null}.</>}
      >
        <button type="button" onClick={reset} className={buttonVariants({ size: "lg" })}>Try again</button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>Go home</Link>
      </StatusPage>
    </main>
  );
}

import { Link } from "@tanstack/react-router";
import { sectionHeaderStyle } from "@/styles/ui";

export function HistoryLoginRequired() {
  return (
    <>
      <h1 className={sectionHeaderStyle}>Login required</h1>
      <p className="m-0 leading-7 text-muted">
        Log in from the market page to see your prediction history.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-accent/10 px-3.5 py-2 text-sm font-bold text-accent no-underline transition hover:bg-accent/20"
      >
        Return to market
      </Link>
    </>
  );
}

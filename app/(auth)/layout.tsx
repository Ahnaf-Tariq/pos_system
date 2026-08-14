import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(46,242,197,0.16),_transparent_50%),linear-gradient(180deg,_#0a0a0b_0%,_#101014_100%)]"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-6 pt-6 pb-2">
        <Link
          href={ROUTES.home}
          className="text-lg font-semibold tracking-tight"
        >
          <span className="text-primary">Auric</span> POS
        </Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-16">
        {children}
      </main>
    </div>
  );
}

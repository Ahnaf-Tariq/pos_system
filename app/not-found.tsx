import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(46,242,197,0.16),_transparent_50%),linear-gradient(180deg,_#0a0a0b_0%,_#101014_100%)]"
      />
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full rounded-lg border border-border/80 bg-card/80 p-8 text-center backdrop-blur">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <MapPinOff className="size-6" />
          </div>

          <p className="mt-6 text-sm font-medium tracking-wide text-primary">
            404
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This route doesn&apos;t exist or may have moved. Head back to your
            shop dashboard to keep working.
          </p>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={ROUTES.dashboard}>
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.home}>Go to home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  ClipboardList,
  LayoutGrid,
  MonitorSmartphone,
  Package,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { ROUTES } from "@/lib/routes";

const HIGHLIGHTS = [
  {
    title: "Sell faster on the floor",
    description:
      "A cashier-first terminal with category tabs, modifier picking, and payment that feels like hardware — not a sluggish web form.",
    icon: MonitorSmartphone,
  },
  {
    title: "Kitchen never misses a ticket",
    description:
      "KDS updates the moment POS sends an order. Timers, bump stages, and live alerts keep the pass moving during rush hour.",
    icon: ChefHat,
  },
  {
    title: "Works when Wi‑Fi doesn’t",
    description:
      "Orders save on-device and sync when you’re back online. No lost sales, no duplicate tickets from retries.",
    icon: WifiOff,
  },
] as const;

const MODULES = [
  {
    title: "Tables & floor",
    description:
      "See which tables are free, occupied, or dirty — open a table’s order in one tap.",
    icon: LayoutGrid,
  },
  {
    title: "Menu & modifiers",
    description:
      "Build categories, prices, images, and add-ons your staff can ring up without training.",
    icon: ClipboardList,
  },
  {
    title: "Inventory & recipes",
    description:
      "Track ingredients, low-stock alerts, and recipe costs so food cost stops being a guess.",
    icon: Package,
  },
  {
    title: "Staff roles",
    description:
      "Owner, manager, cashier, waiter, kitchen — each person only sees what they need.",
    icon: Users,
  },
  {
    title: "Orders & reports",
    description:
      "Full history, voids, and day/hour sales so you know what’s working before tomorrow’s prep.",
    icon: BarChart3,
  },
  {
    title: "Your shops stay private",
    description:
      "Every restaurant is isolated. Only your staff can see your data — other shops never can.",
    icon: ShieldCheck,
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Create your shop",
    description: "Sign up with your business name. Takes under a minute.",
  },
  {
    step: "02",
    title: "Get approved",
    description:
      "We activate your account so only real shops go live on the platform.",
  },
  {
    step: "03",
    title: "Run your floor",
    description:
      "Add menu, open POS, send to kitchen — and start taking orders the same day.",
  },
] as const;

export default function MarketingHomePage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(46,242,197,0.18),_transparent_55%),linear-gradient(180deg,_#0a0a0b_0%,_#101014_45%,_#0a0a0b_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <MarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-28">
        <section className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Built for restaurant & shop owners
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Run your shop like a pro — without expensive ERP complexity
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Auric POS is the all-in-one point of sale and restaurant OS for
            independent cafés, restaurants, and retail counters. Take orders
            faster, keep kitchen and floor aligned, track stock, and see real
            sales numbers — from one clean system your staff will actually use.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="xl">
              <Link href={ROUTES.signup}>
                Create your shop
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href={ROUTES.login}>Sign in to dashboard</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card to start. Multi-location ready. Offline-safe
            checkout.
          </p>
        </section>

        <section className="mt-20 grid gap-6 border-t border-border/60 pt-12 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-lg border border-gray-700 p-5"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-y-100"
              />
              <div className="relative z-10 space-y-3">
                <item.icon className="size-5 text-primary transition-colors duration-500 group-hover:text-black" />
                <h2 className="text-base font-semibold text-foreground transition-colors duration-500 group-hover:text-black">
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-500 group-hover:text-black">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Everything a busy shop needs — in one place
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Stop juggling WhatsApp orders, paper KOTs, and spreadsheet stock.
              Auric POS replaces the patchwork with tools your cashiers,
              waiters, and kitchen already understand.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => (
              <article
                key={module.title}
                className="group relative overflow-hidden rounded-lg border border-gray-700 p-5"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-y-100"
                />
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2">
                    <module.icon className="size-4 text-primary transition-colors duration-500 group-hover:text-black" />
                    <h3 className="text-sm font-semibold text-foreground transition-colors duration-500 group-hover:text-black ">
                      {module.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-500 group-hover:text-black ">
                    {module.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-border/60 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Live in three steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((item) => (
              <article
                key={item.step}
                className="group relative overflow-hidden rounded-lg border border-gray-700 p-5"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-y-100"
                />
                <div className="relative z-10 space-y-3">
                  <p className="text-sm font-semibold text-primary transition-colors duration-500 group-hover:text-black">
                    {item.step}
                  </p>
                  <h3 className="text-base font-semibold text-foreground transition-colors duration-500 group-hover:text-black">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-500 group-hover:text-black/80">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-border/60 pt-12">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Ready to modernize your counter?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Join shop owners who want Petpooja-class operations without the
              bloated setup. Create your Auric POS shop today — we’ll activate
              you once your account is reviewed.
            </p>
            <div className="mt-8">
              <Button asChild size="xl">
                <Link href={ROUTES.signup}>
                  Get started free
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <p>
            <span className="text-primary">Auric</span> POS
          </p>
          <p>Built for restaurants & retail shops</p>
        </div>
      </footer>
    </div>
  );
}

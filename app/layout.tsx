import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdProvider } from "@/components/providers/antd-provider";
import { AppToaster } from "@/components/ui/app-toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Auric POS",
    template: "%s · Auric POS",
  },
  description:
    "Premium multi-location POS and restaurant management for modern hospitality teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AntdProvider>
          {children}
          <AppToaster />
        </AntdProvider>
      </body>
    </html>
  );
}

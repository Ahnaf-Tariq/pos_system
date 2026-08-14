import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Create shop",
};

export default function SignupPage() {
  return (
    <Card className="border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle>Create your shop</CardTitle>
        <CardDescription>
          Register your restaurant or retail business. Accounts start as pending
          until approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={ROUTES.login} className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

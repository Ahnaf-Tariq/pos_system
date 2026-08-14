"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import {
  getShopAccessForAuth,
  isPlatformAdmin,
  provisionShopAccount,
} from "@/lib/auth/shop-access";
import { getDefaultRouteForRole } from "@/lib/navigation";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { AccountStatus, type StaffRole } from "@/types/enums";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      toast.error(error?.message ?? "Unable to sign in");
      return;
    }

    const admin = await isPlatformAdmin(supabase, data.user.id);

    let shop = await getShopAccessForAuth(supabase, data.user.id);

    if (!shop) {
      const meta = data.user.user_metadata ?? {};
      const businessName =
        typeof meta.business_name === "string" ? meta.business_name : null;
      const ownerName =
        typeof meta.full_name === "string"
          ? meta.full_name
          : values.email.split("@")[0];
      const businessType =
        typeof meta.business_type === "string"
          ? meta.business_type
          : "restaurant";

      if (businessName) {
        try {
          const provisioned = await provisionShopAccount({
            supabase,
            authId: data.user.id,
            businessName,
            ownerName,
            businessType,
            email: values.email,
          });
          shop = provisioned.shop;
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not finish shop setup",
          );
          return;
        }
      }
    }

    if (!shop || shop.status !== AccountStatus.APPROVED) {
      if (admin) {
        toast.success("Signed in");
        router.replace(ROUTES.platformShops);
        router.refresh();
        return;
      }
      toast.success("Signed in — awaiting shop approval");
      router.replace(ROUTES.pendingApproval);
      router.refresh();
      return;
    }

    toast.success("Signed in");

    const { data: staff } = await supabase
      .from("staff_members")
      .select("role")
      .eq("user_id", shop.user_id)
      .eq("auth_id", data.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    router.replace(
      getDefaultRouteForRole((staff?.role as StaffRole | undefined) ?? null),
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@shop.com"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Enter password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full"
        size="sm"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

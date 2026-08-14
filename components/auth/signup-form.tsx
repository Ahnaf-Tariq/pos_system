"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Select } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { provisionShopAccount } from "@/lib/auth/shop-access";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { BusinessType } from "@/types/enums";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";

export function SignupForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      email: "",
      password: "",
      businessType: BusinessType.RESTAURANT,
    },
  });

  async function onSubmit(values: SignupInput) {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.ownerName,
          business_name: values.businessName,
          business_type: values.businessType,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data.user) {
      toast.error("Signup failed. Please try again.");
      return;
    }

    if (!data.session) {
      toast.success(
        "Check your email to confirm your account, then sign in.",
      );
      return;
    }

    try {
      await provisionShopAccount({
        supabase,
        authId: data.user.id,
        businessName: values.businessName,
        ownerName: values.ownerName,
        businessType: values.businessType,
        email: values.email,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create shop account",
      );
      return;
    }

    toast.success("Shop created — awaiting approval");
    router.replace(ROUTES.pendingApproval);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          placeholder="Cafe Aurum"
          {...register("businessName")}
        />
        {errors.businessName ? (
          <p className="text-sm text-destructive">
            {errors.businessName.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerName">Owner name</Label>
        <Input
          id="ownerName"
          placeholder="Your full name"
          {...register("ownerName")}
        />
        {errors.ownerName ? (
          <p className="text-sm text-destructive">{errors.ownerName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType">Business type</Label>
        <Controller
          name="businessType"
          control={control}
          render={({ field }) => (
            <Select
              id="businessType"
              className="w-full"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: BusinessType.RESTAURANT, label: "Restaurant" },
                { value: BusinessType.RETAIL, label: "Retail" },
              ]}
            />
          )}
        />
        {errors.businessType ? (
          <p className="text-sm text-destructive">
            {errors.businessType.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="owner@shop.com"
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
          autoComplete="new-password"
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
        {isSubmitting ? "Creating shop…" : "Create shop account"}
      </Button>
    </form>
  );
}

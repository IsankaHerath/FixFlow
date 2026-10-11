"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";
import { Button } from "./ui/button";
type Fields = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};
export function AuthForm({ mode }: { mode: string }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const search = useSearchParams();
  const isRegister = mode === "register";
  const isForgot = mode === "forgot-password";
  const isReset = mode === "reset-password";
  const submit = handleSubmit(async (v) => {
    setError("");
    try {
      if ((isRegister || isReset) && v.password !== v.confirm)
        throw new Error("Passwords do not match.");
      if (isForgot) {
        const result = await authClient.requestPasswordReset({
          email: v.email,
          redirectTo: "/reset-password",
        });
        if (result.error) throw new Error(result.error.message);
        setMessage(
          "If an account exists, password reset instructions have been requested. In development, check the local mail outbox.",
        );
        return;
      }
      if (isReset) {
        const result = await authClient.resetPassword({
          token: search.get("token") ?? "",
          newPassword: v.password,
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("Your password has been reset. You can now sign in.");
        return;
      }
      const result = isRegister
        ? await authClient.signUp.email({
            email: v.email,
            password: v.password,
            name: v.name,
          })
        : await authClient.signIn.email({
            email: v.email,
            password: v.password,
          });
      if (result.error) throw new Error(result.error.message);
      if (isRegister && v.phone) {
        const response = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            phone: v.phone,
            emailNotifications: true,
          }),
        });
        if (!response.ok)
          throw new Error(
            "Account created, but phone update failed. Update it in your profile.",
          );
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  });
  return (
    <main id="main" className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <ShieldCheck size={48} className="teal" />
          <h1 style={{ marginTop: 30 }}>
            Your next journey
            <br />
            starts with
            <br />
            better care.
          </h1>
          <p>
            Every vehicle. Every service. Every detail.
            <br />
            Together in one secure workspace.
          </p>
        </div>
        <small>BUILT FOR THE ROAD AHEAD.</small>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div style={{ marginBottom: 38 }}>
            <Brand />
          </div>
          <h1>
            {isRegister
              ? "A fresh start for vehicle care."
              : isForgot
                ? "Forgot your password?"
                : isReset
                  ? "Set a new password."
                  : "Good to see you again."}
          </h1>
          <p>
            {isRegister
              ? "Create your free vehicle owner account."
              : isForgot
                ? "We’ll help you get back into your account."
                : isReset
                  ? "Choose a password of at least 12 characters."
                  : "Sign in to keep your vehicle care moving."}
          </p>
          {message ? (
            <div className="notice">
              {message}
              <p style={{ marginTop: 15 }}>
                <Link href="/login">Back to sign in →</Link>
              </p>
            </div>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              {isRegister && (
                <>
                  <label className="field">
                    Full name
                    <input
                      autoComplete="name"
                      required
                      maxLength={100}
                      {...register("name")}
                    />
                  </label>
                  <label className="field">
                    Phone number
                    <input
                      autoComplete="tel"
                      type="tel"
                      required
                      maxLength={30}
                      {...register("phone")}
                    />
                  </label>
                </>
              )}
              {!isReset && (
                <label className="field">
                  Email address
                  <input
                    autoComplete="email"
                    type="email"
                    required
                    {...register("email")}
                  />
                </label>
              )}
              {!isForgot && (
                <label className="field">
                  Password
                  <input
                    type="password"
                    autoComplete={
                      isRegister || isReset
                        ? "new-password"
                        : "current-password"
                    }
                    minLength={isRegister || isReset ? 12 : 1}
                    maxLength={128}
                    required
                    {...register("password")}
                  />
                </label>
              )}
              {(isRegister || isReset) && (
                <label className="field">
                  Confirm password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    {...register("confirm")}
                  />
                </label>
              )}
              {!isRegister && !isForgot && !isReset && (
                <Link href="/forgot-password" className="text-link teal">
                  Forgot password?
                </Link>
              )}
              {error && (
                <div role="alert" className="form-error">
                  {error}
                </div>
              )}
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? "Please wait…"
                  : isRegister
                    ? "Create account"
                    : isForgot
                      ? "Request reset link"
                      : isReset
                        ? "Reset password"
                        : "Sign in"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <div className="form-footer">
            {isRegister ? (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            ) : (
              <>
                New to FixFlow? <Link href="/register">Create an account</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

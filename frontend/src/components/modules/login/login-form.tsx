"use client"

import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoginPanelCard } from "./login-panel"
import { useLogin } from "@/hooks/use-session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const router = useRouter()
    const login = useLogin()
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (login.isPending) return
        const data = new FormData(event.currentTarget)
        try {
            await login.mutateAsync({
                username: String(data.get("username") ?? ""),
                password: String(data.get("password") ?? ""),
            })
            router.push("/dashboard")
        } catch {
            /* The mutation error remains visible in the form. */
        }
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-6 md:p-8" onSubmit={submit} aria-busy={login.isPending}>
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-bold">Welcome back</h1>
                                <p className="text-balance text-muted-foreground">
                                    Login to your KFF account
                                </p>
                            </div>
                            {login.error && (
                                <Alert variant="destructive">
                                    <AlertTitle>Unable to sign in</AlertTitle>
                                    <AlertDescription>{login.error.message}</AlertDescription>
                                </Alert>
                            )}
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    id="email"
                                    name="username"
                                    autoComplete="username"
                                    disabled={login.isPending}
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                />
                            </Field>
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    <a
                                        href="#"
                                        className="ml-auto text-sm underline-offset-2 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    disabled={login.isPending}
                                    required
                                />
                            </Field>
                            <Field>
                                <Button type="submit" disabled={login.isPending}>
                                    {login.isPending ? "Signing in..." : "Login"}
                                </Button>
                            </Field>
                            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card"></FieldSeparator>
                            <FieldDescription className="text-center">
                                Don&apos;t have an account? <a href="#">Sign up</a>
                            </FieldDescription>
                        </FieldGroup>
                    </form>
                    <div className="relative hidden md:block">
                        <div className="absolute inset-0">
                            <LoginPanelCard />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <FieldDescription className="px-6 text-center">
                By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
                <a href="#">Privacy Policy</a>.
            </FieldDescription>
        </div>
    )
}

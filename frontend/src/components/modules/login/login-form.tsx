"use client"

import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoginPanelCard } from "./login-panel"
import { useLogin, useSession } from "@/hooks/use-session"
import { getHomeRouteForSession } from "@/lib/workspace-access"
import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const router = useRouter()
    const session = useSession()
    const login = useLogin()
    const [hasAuthError, setHasAuthError] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        if (session.data) {
            router.replace(getHomeRouteForSession(session.data))
        }
    }, [router, session.data])
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (login.isPending) return
        setHasAuthError(false)
        const data = new FormData(event.currentTarget)
        try {
            const signedInSession = await login.mutateAsync({
                username: String(data.get("username") ?? ""),
                password: String(data.get("password") ?? ""),
            })
            router.push(getHomeRouteForSession(signedInSession))
        } catch {
            setHasAuthError(true)
        }
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-5 sm:p-6 md:p-8" onSubmit={submit} aria-busy={login.isPending}>
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-bold">Welcome back</h1>
                                <p className="text-balance text-muted-foreground">
                                    Login to your KFF account
                                </p>
                            </div>
                            <Field data-invalid={hasAuthError}>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    id="email"
                                    name="username"
                                    autoComplete="username"
                                    disabled={login.isPending}
                                    type="email"
                                    placeholder="m@example.com"
                                    aria-invalid={hasAuthError}
                                    onChange={() => hasAuthError && setHasAuthError(false)}
                                    required
                                />
                            </Field>
                            <Field data-invalid={hasAuthError}>
                                <FieldLabel htmlFor="password">Password</FieldLabel>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                                        disabled={login.isPending}
                                        aria-invalid={hasAuthError}
                                        onChange={() => hasAuthError && setHasAuthError(false)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        disabled={login.isPending}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showPassword}
                                        aria-controls="password"
                                        className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-md px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" aria-hidden="true" />
                                        ) : (
                                            <Eye className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            </Field>
                            <Field>
                                <Button type="submit" className="w-full" disabled={login.isPending}>
                                    {login.isPending ? "Signing in..." : "Login"}
                                </Button>
                            </Field>
                        </FieldGroup>
                    </form>
                    <div className="relative hidden md:block">
                        <div className="absolute inset-0">
                            <LoginPanelCard />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = localFont({
    src: "./fonts/inter-variable.woff2",
    weight: "100 900",
    style: "normal",
    display: "swap",
    variable: "--font-inter",
    adjustFontFallback: "Arial",
    fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});


export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={cn("font-sans", inter.variable)}>
            <body>
                {/* Only global providers go here, NO UI like Navbars */}
                <Toaster>
                    <QueryProvider>{children}</QueryProvider>
                </Toaster>
            </body>
        </html>
    );
}



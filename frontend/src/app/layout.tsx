import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });


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



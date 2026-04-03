import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./_providers/theme-provider";
import { OfflineProvider } from "./_components/providers/offline-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Tele Medical",
  description: "Tele Medical Application",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tele Medical",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
      >
        <OfflineProvider>
          {children}
        </OfflineProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

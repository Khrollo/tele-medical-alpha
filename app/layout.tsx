import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./_providers/theme-provider";
import { OfflineProvider } from "./_components/providers/offline-provider";
import { OfflineSyncIndicator } from "./_components/offline-sync-indicator";
import { Toaster } from "@/components/ui/toaster";

const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

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
    <html lang="en" data-theme="cool" suppressHydrationWarning>
      <body
        className={`${interTight.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="cool"
          themes={["warm", "bone", "cool", "sage", "rose", "graphite"]}
          disableTransitionOnChange
        >
          <OfflineProvider>
            {children}
            <div className="fixed bottom-4 right-4 z-50">
              <OfflineSyncIndicator />
            </div>
          </OfflineProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

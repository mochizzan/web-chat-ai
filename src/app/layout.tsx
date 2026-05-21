import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WebSocketProvider } from "@/context/websocket-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MI-Labs Chat - AI-Powered Chat Dashboard",
  description: "Modern AI Chat Dashboard built with Next.js, TypeScript, and Tailwind CSS. Powered by MI-Labs.",
  keywords: ["MI-Labs", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI chat", "React"],
  authors: [{ name: "MI-Labs Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "MI-Labs Chat",
    description: "AI-powered chat dashboard",
    url: "https://chat.mi-labs.ai",
    siteName: "MI-Labs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MI-Labs Chat",
    description: "AI-powered chat dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

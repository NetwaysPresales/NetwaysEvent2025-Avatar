import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProviderWrapper } from '@/components/providers';

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Netways Avatar",
  description: "AI-powered voice assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} font-sans antialiased`}
      >
        <SessionProviderWrapper>
          <ProfileProvider>
            {children}
          </ProfileProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

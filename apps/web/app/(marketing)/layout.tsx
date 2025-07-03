import { Metadata } from "next";
import { Geist } from "next/font/google";
import { MarketingLayoutClient } from "./components/MarketingLayoutClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dayli - Stop managing your work. Start doing it.",
  description: "AI executive assistant that makes every decision about what you should work on, so you don't have to. No task lists. No priorities. Just focus.",
  keywords: "productivity, AI assistant, time management, focus, deep work, executive assistant",
  authors: [{ name: "dayli team" }],
  creator: "dayli",
  publisher: "dayli",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://dayli.app',
    title: 'dayli - Your AI Executive Assistant',
    description: 'Stop managing your work. Start doing it.',
    siteName: 'dayli',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'dayli - AI Executive Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'dayli - Stop managing your work. Start doing it.',
    description: 'AI executive assistant for focused professionals',
    images: ['/twitter-image.png'],
    creator: '@dayliapp',
  },
  alternates: {
    canonical: 'https://dayli.app',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${geistSans.variable} font-sans`}>
      <MarketingLayoutClient>
        {children}
      </MarketingLayoutClient>
    </div>
  );
} 
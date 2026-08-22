import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Batch 1 Candidate Screening",
  description: "Intake, profile and CBT booking for the Batch 1 candidate screening platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

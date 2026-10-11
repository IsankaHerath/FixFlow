import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "FixFlow — Smarter Vehicle Care",
    template: "%s | FixFlow",
  },
  description:
    "Book vehicle services, approve transparent estimates, and follow every repair with FixFlow.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}

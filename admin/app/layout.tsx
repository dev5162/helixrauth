import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Helixrs Auth Admin",
  description: "Product and tenant configuration for the Helixrs auth gateway",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

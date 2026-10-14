import "./globals.css";
export const metadata = {
  title: "DangoGolf | Myrtle Beach Championship 2026",
  description: "America vs Europe. Five rounds. One championship.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/dango-app-icon.svg", apple: "/dango-app-icon.svg" },
  appleWebApp: { capable: true, title: "DangoGolf", statusBarStyle: "black-translucent" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

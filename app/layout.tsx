import "./globals.css";
export const metadata = {
  title: "DangoGolf | Myrtle Beach 2027",
  description: "2026 champions: Team America. The 2027 Myrtle Beach rematch is coming. Explore the 2026 championship archive and watch for trip announcements.",
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

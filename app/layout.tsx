import "./globals.css";
export const metadata = {
  title: "Myrtle Beach · Championship 2026",
  description: "Five rounds. Two teams. One championship.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

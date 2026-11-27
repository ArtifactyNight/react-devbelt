import type { ReactNode } from "react";
import { DevBelt } from "react-devbelt";

export const metadata = { title: "devbelt · Next.js example" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* renders nothing in production and on the server */}
        <DevBelt />
      </body>
    </html>
  );
}

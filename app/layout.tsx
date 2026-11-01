import type { ReactNode } from "react";
import "../src/styles.css";
import "../src/design.css";
export const metadata = { title: "MyFTCSpace", description: "A private team workspace for the FTC season." };
export default function RootLayout({children}: {children: ReactNode}) { return <html lang="en"><head><link rel="icon" href="/favicon.svg" /></head><body>{children}</body></html>; }

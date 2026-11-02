import type { ReactNode } from "react";
import "../src/fonts.css";
import "../src/styles.css";
import "../src/redesign.css";
import "../src/surfaces.css";
export const metadata = { title: "MyFTCSpace", description: "A private team workspace for the FTC season." };
export default function RootLayout({children}: {children: ReactNode}) { return <html lang="en"><head><meta name="theme-color" content="#f7f7f8" /><link rel="icon" href="/favicon.svg" /></head><body>{children}</body></html>; }

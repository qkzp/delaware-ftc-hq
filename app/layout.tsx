import type {Viewport} from "next";
import ExperienceRuntime,{ScreenBoundary} from "../src/components/ExperienceRuntime";
import {preferenceBootstrap} from "../src/preferences";
import type { ReactNode } from "react";
import "../src/fonts.css";
import "../src/styles.css";
import "../src/redesign.css";
import "../src/surfaces.css";
import "../src/experience.css";
import "../src/atelier.css";
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",interactiveWidget:"resizes-content"};
export const metadata = { title: "MyFTCSpace", description: "A private team workspace for the FTC season." };
export default function RootLayout({children}: {children: ReactNode}) { return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:preferenceBootstrap}}/><meta name="theme-color" content="#f7f7f8" /><link rel="icon" href="/favicon.svg" /></head><body><ExperienceRuntime/><ScreenBoundary>{children}</ScreenBoundary></body></html>; }

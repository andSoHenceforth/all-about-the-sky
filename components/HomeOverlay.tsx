"use client";
import Link from "next/link";
import SkyControls from "./SkyControls";
import { useSky } from "./SkyProvider";

export default function HomeOverlay() {
  const { place, clock } = useSky();
  return (
    <main className="pointer-events-none relative flex h-dvh flex-col justify-between overflow-hidden p-4 text-white sm:p-6">
      <header>
        <h1 className="text-3xl font-semibold drop-shadow sm:text-5xl">
          All About the Sky
        </h1>
        <p className="mt-1 text-slate-100 drop-shadow">
          {place
            ? `The sky over ${place}${clock ? ` · ${clock}` : ""}`
            : "Push, drag or swipe the clouds."}
        </p>
        <Link
          href="/learn"
          className="pointer-events-auto mt-4 inline-block rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
        >
          Learn about clouds!
        </Link>
      </header>
      <SkyControls />
    </main>
  );
}

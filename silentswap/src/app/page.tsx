"use client";
import dynamic from "next/dynamic";

const FhevmLoader = dynamic(() => import("../components/SilentSwap"), {
  ssr: false,
});

export default function Page() {
  return <FhevmLoader />;
}

"use client";

import dynamic from "next/dynamic";

// Client-side only components
const NotificationPrompt = dynamic(
  () =>
    import("@/components/_comps/notification-prompt").then((mod) => ({
      default: mod.NotificationPrompt,
    })),
  { ssr: false }
);

const AudioEnabler = dynamic(
  () =>
    import("@/components/_comps/audio-enabler").then((mod) => ({
      default: mod.AudioEnabler,
    })),
  { ssr: false }
);

export function ClientComponents() {
  return (
    <>
      <NotificationPrompt />
      <AudioEnabler />
    </>
  );
}

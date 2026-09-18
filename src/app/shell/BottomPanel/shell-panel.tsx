import { memo } from "react";

import { ShellInput } from "@/app/shell/BottomPanel/shell-input";
import { ShellTranscript } from "@/app/shell/BottomPanel/shell-transcript";

/**
 * Subscribes to nothing itself — the transcript and the input each own their
 * slice, so shell output never re-renders the input and typing never re-renders
 * the transcript.
 */
export const ShellPanel = memo(function ShellPanel() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--terminal-bg)" }}
    >
      <ShellTranscript />
      <ShellInput />
    </div>
  );
});

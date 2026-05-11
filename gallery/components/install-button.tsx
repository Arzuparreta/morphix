"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (extensionId: string, message: unknown) => Promise<unknown>;
      };
    };
  }
}

interface Props {
  styleSlug: string;
  styleName: string;
}

export function InstallButton({ styleSlug, styleName }: Props) {
  const [pending, setPending] = useState(false);

  async function install() {
    setPending(true);
    try {
      // Try to communicate with the Morphix extension
      const extensionId = "YOUR_EXTENSION_ID"; // Replace with actual Chrome Web Store ID
      try {
        await window.chrome?.runtime?.sendMessage?.(extensionId, {
          type: "MORPHIX_INSTALL_STYLE",
          slug: styleSlug,
        });
        return;
      } catch {
        // Extension not installed or not responding
      }

      // Fallback: open the .morphix download
      window.open(`/api/styles/${styleSlug}/download`, "_blank");

      // Also try the custom protocol
      setTimeout(() => {
        window.location.href = `web+morphix://install/${styleSlug}`;
      }, 500);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={install} disabled={pending}>
      <Download className="h-4 w-4 mr-1" />
      {pending ? "Opening..." : `Install ${styleName}`}
    </Button>
  );
}

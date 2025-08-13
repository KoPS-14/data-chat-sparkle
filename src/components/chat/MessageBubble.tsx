import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export type MessageRole = "user" | "assistant" | "system";

interface MessageBubbleProps {
  role: MessageRole;
  children: ReactNode;
}

export function MessageBubble({ role, children }: MessageBubbleProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  return (
    <div
      className={cn(
  "w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "rounded-lg p-4 shadow-sm",
          isSystem && "bg-muted text-muted-foreground",
          !isSystem && (isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"),
          !isUser && "glass-panel",
          // Let assistant/system bubbles (which render charts) span full width; keep user text reasonably narrow
          isUser ? "max-w-[75%]" : "w-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

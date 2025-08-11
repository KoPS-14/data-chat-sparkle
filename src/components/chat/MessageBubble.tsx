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
        "max-w-3xl w-full flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "rounded-lg p-4 shadow-sm",
          isSystem && "bg-muted text-muted-foreground",
          !isSystem && (isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"),
          "glass-panel"
        )}
      >
        {children}
      </div>
    </div>
  );
}

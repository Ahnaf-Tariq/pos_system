"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerStyle={{ top: 16 }}
      toastOptions={{
        duration: 3500,
        className: "text-sm font-medium shadow-lg",
        style: {
          background: "#141416",
          color: "#f4f4f5",
          border: "1px solid #27272a",
          borderRadius: "0.75rem",
          padding: "10px 10px",
          maxWidth: "420px",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.55)",
        },
        success: {
          iconTheme: {
            primary: "#2ef2c5",
            secondary: "#041412",
          },
          style: {
            background: "#12241f",
            color: "#f4f4f5",
            border: "1px solid color-mix(in srgb, #2ef2c5 50%, #27272a)",
          },
        },
        error: {
          iconTheme: {
            primary: "#b54a4a",
            secondary: "#fafafa",
          },
          style: {
            background: "#1a1212",
            color: "#f4f4f5",
            border: "1px solid color-mix(in srgb, #b54a4a 55%, #27272a)",
          },
        },
      }}
    />
  );
}

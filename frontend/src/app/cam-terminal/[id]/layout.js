import { notFound } from "next/navigation";

// This allows the page to render even if no real analysis is found
export default function CAMTerminalLayout({ children }) {
  return children;
}

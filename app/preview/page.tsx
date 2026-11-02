import { notFound } from "next/navigation";
import { PreviewWorkspace } from "@/components/preview-workspace";
export default function PreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.LENDLOOP_ENABLE_PREVIEW !== "true"
  )
    notFound();
  return <PreviewWorkspace />;
}

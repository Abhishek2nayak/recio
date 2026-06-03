/** Loading + error states for the media detail pages. */
import { Link } from "react-router-dom";
import { Skeleton } from "./ui.js";

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <Skeleton className="h-4 w-20" />
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export function DetailError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-center">
      <p className="text-sm text-danger">{message}</p>
      <Link to="/dashboard" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
        ← Back to library
      </Link>
    </div>
  );
}

import { cn } from "@/shared/utils/cn";

const Skeleton = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn("animate-pulse rounded-md bg-accent", className)}
    data-slot="skeleton"
    {...props}
  />
);

export { Skeleton };

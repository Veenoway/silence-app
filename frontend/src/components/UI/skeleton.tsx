import { cn } from "../../utils/cn";

const Skeleton = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-white/10 animate-pulse rounded-md", className)}
      {...props}
    />
  );
};

export { Skeleton };

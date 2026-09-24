import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/shared/utils/cn";

const Tabs = ({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) => (
  <TabsPrimitive.Root
    className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
    data-orientation={orientation}
    data-slot="tabs"
    orientation={orientation}
    {...props}
  />
);

const TabsList = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    className={cn(
      "group/tabs-list bg-muted text-muted-foreground flex h-9 w-full items-center justify-center rounded-lg p-[3px] group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
      className
    )}
    data-slot="tabs-list"
    {...props}
  />
);

const TabsTrigger = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      "text-body text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:outline-ring focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:text-foreground dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground dark:hover:text-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-md border border-transparent px-2 py-1 font-medium whitespace-nowrap transition-colors group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="tabs-trigger"
    {...props}
  />
);

const TabsContent = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    className={cn("flex-1 outline-none", className)}
    data-slot="tabs-content"
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };

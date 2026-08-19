import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/shared/utils/cn';

export type TabsWithIconItem = {
  content: ReactNode;
  icon: ReactNode;
  name: string;
  value: string;
};

export function TabsWithIcon({
  className,
  defaultValue,
  onValueChange,
  tabs,
  value,
}: {
  className?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  tabs: TabsWithIconItem[];
  value?: string;
}) {
  return (
    <Tabs
      className={cn('gap-4', className)}
      {...(defaultValue === undefined ? {} : { defaultValue })}
      {...(onValueChange === undefined ? {} : { onValueChange })}
      {...(value === undefined ? {} : { value })}
    >
      <TabsList>
        {tabs.map(({ icon, name, value: tabValue }) => (
          <TabsTrigger key={tabValue} value={tabValue}>
            {icon}
            {name}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

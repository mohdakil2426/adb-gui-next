import { BookIcon, GiftIcon, HeartIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/shared/utils/cn';

export type TabsWithIconItem = {
  content: ReactNode;
  icon: ReactNode;
  name: string;
  value: string;
};

const demoTabs: TabsWithIconItem[] = [
  {
    content: (
      <p className="text-body text-muted-foreground">
        Discover <span className="font-semibold text-foreground">fresh ideas</span>, trending
        topics, and hidden gems curated just for you. Start exploring and let your curiosity lead
        the way!
      </p>
    ),
    icon: <BookIcon aria-hidden="true" />,
    name: 'Explore',
    value: 'explore',
  },
  {
    content: (
      <p className="text-body text-muted-foreground">
        All your <span className="font-semibold text-foreground">favorites</span> are saved here.
        Revisit articles, collections, and moments you love, any time you want a little inspiration.
      </p>
    ),
    icon: <HeartIcon aria-hidden="true" />,
    name: 'Favorites',
    value: 'favorites',
  },
  {
    content: (
      <p className="text-body text-muted-foreground">
        <span className="font-semibold text-foreground">Surprise!</span> Here&apos;s something
        unexpected — a fun fact, a quirky tip, or a daily challenge. Come back for a new surprise
        every day!
      </p>
    ),
    icon: <GiftIcon aria-hidden="true" />,
    name: 'Surprise',
    value: 'surprise',
  },
];

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

const TabsWithIconDemo = () => (
  <div className="@container w-full max-w-md">
    <TabsWithIcon defaultValue="explore" tabs={demoTabs} />
  </div>
);

export default TabsWithIconDemo;

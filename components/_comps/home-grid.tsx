"use client";

import { SECTION_CARDS } from "./home-sections";
import { HomeCard } from "./home-card";

export function HomeGrid() {
  return (
    <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {SECTION_CARDS.map((s) => (
        <HomeCard
          key={s.key}
          href={s.href}
          title={s.title}
          description={s.description}
          Icon={s.Icon}
        />
      ))}
    </div>
  );
}

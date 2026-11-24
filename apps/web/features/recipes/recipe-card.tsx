import Link from 'next/link';

import { recipeTime } from '@repo/shared/domain';

import { StorePhoto } from '@/features/catalog/store-photo';
import { Money } from '@/features/shell/market';
import { mediaUrl } from '@/lib/site';

import { KadaiArt } from './kadai-art';

import type { RecipeCard as Recipe } from '@repo/db/store';

/** "Chai & drinks" and the rest: the shelf's chips and a recipe's kind chip (plan §4.2). */
export const KIND_LABEL: Record<Recipe['kind'], string> = {
  snacks: 'Snacks',
  breakfast: 'Breakfast',
  dinner: 'Dinner',
  sweets: 'Sweets',
  drinks: 'Chai & drinks',
};

/**
 * A recipe on the shelf (D-203, plan §4.2): the dish photo with its time, the name, "<state> · serves n" and the kit
 * price with its struck figure beside it (every kit, answer 5). Server-drawn; the prices are the visitor's dollars.
 */
export function RecipeCard({ recipe, size = 'md' }: { recipe: Recipe; size?: 'md' | 'sm' }): React.JSX.Element {
  return (
    <Link href={`/recipes/${recipe.slug}`} data-kind={recipe.kind} className="group block">
      <span className="bg-land relative block aspect-[4/5] overflow-hidden rounded-lg">
        <KadaiArt className="text-ink-muted/40 absolute inset-0 m-auto h-1/2 w-1/2" />
        {recipe.photo_path ? (
          <StorePhoto
            src={mediaUrl(recipe.photo_path)}
            alt={recipe.name}
            sizes={size === 'sm' ? '160px' : '(min-width: 768px) 30vw, 50vw'}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <span className="bg-paper/90 font-ui absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[12px] font-semibold">
          {recipeTime(recipe.minutes, recipe.soak_hours)}
        </span>
      </span>
      <span className={`font-display mt-2 block leading-tight ${size === 'sm' ? 'text-[17px]' : 'text-[20px]'}`}>{recipe.name}</span>
      <span className="text-ink-muted block text-[13px]">
        {recipe.region_name ?? 'All of India'} · serves {recipe.serves}
      </span>
      <span className="font-ui mt-0.5 block text-[14px]">
        <s className="text-ink-muted mr-1.5" aria-label="Was">
          <Money cents={recipe.kit_cents} of={{ recipe: recipe.slug }} wasOf="food" />
        </s>
        <b className="font-semibold">
          Kit <Money cents={recipe.kit_cents} of={{ recipe: recipe.slug }} />
        </b>
        <span className="text-ink-muted"> · {recipe.kit_count} pieces</span>
      </span>
    </Link>
  );
}

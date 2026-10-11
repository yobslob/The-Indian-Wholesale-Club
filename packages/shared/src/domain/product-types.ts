/**
 * The product types IWC sells (D-002, D-106): one list for the database enum, the menus, the See all routes and the
 * labels, so a type is added in one place. A region (state) sells all three.
 */
export const PRODUCT_TYPES = ['clothing', 'food', 'home'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** What customers read: the menu, the See all page title, the region page row. */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  clothing: 'Clothing',
  food: 'Food',
  home: 'Home & gifts',
};

/** The See all page for a type (D-062): /clothing, /food, /home-and-gifts (D-106, D-110). */
export const PRODUCT_TYPE_PATH: Record<ProductType, string> = {
  clothing: '/clothing',
  food: '/food',
  home: '/home-and-gifts',
};

export const isProductType = (value: unknown): value is ProductType =>
  typeof value === 'string' && (PRODUCT_TYPES as readonly string[]).includes(value);

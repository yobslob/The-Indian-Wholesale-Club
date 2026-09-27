# Mobile App Implementation Plan

## 1. Screen Navigation Hierarchy

The app utilizes a bottom tab navigation paradigm as the primary navigation structure, with nested stack navigators for deeper flows.

### Navigation Diagram

```mermaid
graph TD
    Root[Root Layout _layout.tsx] --> Auth[(auth) Group]
    Root --> Tabs[(tabs) Layout]
    Root --> Modals[Modal Routes]

    Auth --> Login[Login]
    Auth --> Signup[Sign Up]
    Auth --> ForgotPassword[Forgot Password]

    Tabs --> ShopTab[Shop Tab]
    Tabs --> SearchTab[Search Tab]
    Tabs --> BagTab[Bag Tab]
    Tabs --> WishlistTab[Wishlist Tab]
    Tabs --> ProfileTab[Profile Tab]

    ShopTab --> Home[Home Screen]
    Home --> CategoryList[Category List]
    CategoryList --> CategoryDetail[Category Detail]
    CategoryDetail --> ProductDetail[Product Detail]
    Home --> ProductDetail

    SearchTab --> SearchHome[Search Home]
    SearchHome --> SearchResults[Search Results]
    SearchResults --> ProductDetail

    BagTab --> Cart[Cart]
    Cart --> Checkout[Checkout Flow]
    Checkout --> Address[Address]
    Address --> Payment[Payment]
    Payment --> Review[Review]
    Review --> Confirmation[Order Confirmation]

    WishlistTab --> WishlistGrid[Wishlist Grid]
    WishlistGrid --> ProductDetail

    ProfileTab --> ProfileHome[Profile Overview]
    ProfileHome --> OrderHistory[Order History]
    OrderHistory --> OrderDetail[Order Detail]
    ProfileHome --> AddressBook[Address Book]
    ProfileHome --> Settings[Settings]

    Modals --> SizeGuide[Size Guide Modal]
    Modals --> ImageZoom[Image Zoom Modal]
    Modals --> Filters[Filter Sheet Modal]
```

### Detailed Screen Table

| Tab          | Screen          | Route                             | Description                                                      |
| ------------ | --------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Shop**     | Home            | `/(tabs)/index`                   | Featured products, categories, promotional banners.              |
|              | Category List   | `/(tabs)/category`                | List of all main product categories.                             |
|              | Category Detail | `/(tabs)/category/[id]`           | Product grid for a specific category with filter options.        |
|              | Product Detail  | `/(tabs)/product/[id]`            | Product gallery, size/color selection, description, add to cart. |
| **Search**   | Search Home     | `/(tabs)/search/index`            | Recent searches, trending terms, and categories.                 |
|              | Search Results  | `/(tabs)/search/[query]`          | Product grid showing search results with filtering.              |
| **Bag**      | Cart            | `/(tabs)/bag/index`               | Items in cart, subtotal, promo code input, checkout button.      |
|              | Checkout        | `/(tabs)/bag/checkout`            | Multi-step checkout (Address → Payment → Review).                |
|              | Confirmation    | `/(tabs)/bag/confirmation`        | Order success screen with order number and tracking link.        |
| **Wishlist** | Wishlist        | `/(tabs)/wishlist/index`          | Grid of saved products.                                          |
| **Profile**  | Profile Home    | `/(tabs)/profile/index`           | User overview, quick links to history, settings.                 |
|              | Order History   | `/(tabs)/profile/orders`          | List of past and current orders.                                 |
|              | Order Detail    | `/(tabs)/profile/orders/[id]`     | Specific order details, timeline tracking.                       |
|              | Addresses       | `/(tabs)/profile/addresses`       | Manage saved shipping and billing addresses.                     |
|              | Settings        | `/(tabs)/profile/settings`        | Notification preferences, account management, legal.             |
| _(None)_     | Login/Signup    | `/(auth)/login`, `/(auth)/signup` | Authentication flows (accessible if not authenticated).          |

---

## 2. Expo Router File Structure

The `apps/app/app/` directory uses Expo Router for file-based routing.

```text
apps/app/app/
├── _layout.tsx                 # Root layout (Providers: QueryClient, Theme, Auth)
├── +not-found.tsx              # 404 fallback
├── (tabs)/                     # Main bottom tabs group
│   ├── _layout.tsx             # Tab Navigator configuration
│   ├── index.tsx               # Shop Tab (Home)
│   ├── category/
│   │   ├── index.tsx           # Category List
│   │   └── [id].tsx            # Category Detail
│   ├── product/
│   │   └── [id].tsx            # Product Detail
│   ├── search/
│   │   ├── index.tsx           # Search Home
│   │   └── [query].tsx         # Search Results
│   ├── bag/
│   │   ├── index.tsx           # Cart
│   │   ├── checkout.tsx        # Checkout Flow
│   │   └── confirmation.tsx    # Order Confirmation
│   ├── wishlist/
│   │   └── index.tsx           # Wishlist Grid
│   └── profile/
│       ├── index.tsx           # Profile Overview
│       ├── orders/
│       │   ├── index.tsx       # Order History
│       │   └── [id].tsx        # Order Detail
│       ├── addresses.tsx       # Address Book
│       └── settings.tsx        # Settings
├── (auth)/                     # Authentication flow (No tabs)
│   ├── _layout.tsx             # Stack Navigator for Auth
│   ├── login.tsx               # Login Screen
│   ├── signup.tsx              # Sign Up Screen
│   └── forgot-password.tsx     # Forgot Password Screen
└── modals/                     # Transparent modals
    ├── size-guide.tsx          # Size Guide Modal
    ├── image-zoom.tsx          # Image Zoom Modal
    └── filters.tsx             # Filter Sheet Modal
```

---

## 3. Code Sharing Strategy

The monorepo structure allows significant code sharing between the Next.js web app and the React Native mobile app via the `packages/shared` workspace.

### `packages/shared` (Consumed by Both Apps)

- **`types/database.ts`**: Supabase generated TypeScript definitions (`Database` type).
- **`types/api.ts`**: Custom types for API request/response payloads if needed beyond Supabase types.
- **`schemas/`**: Zod validation schemas.
  - `address.schema.ts`: `z.object({ street: z.string().min(5), zip: z.string().regex(/^\d{5}$/), ... })`
  - `checkout.schema.ts`
- **`constants/`**:
  - `order-statuses.ts`: `export const ORDER_STATUS = { PENDING: 'pending', SHIPPED: 'shipped', ... }`
  - `shipping-tiers.ts`
- **`utils/`**:
  - `formatters.ts`: `formatPrice(amount: number)`, `formatDate(date: string)`
  - `slugify.ts`

### Shared Hooks (TanStack Query)

These hooks reside in `packages/shared/src/hooks/` and abstract the data fetching layer using Supabase client.

- `useProducts()`: Fetches product lists with filtering and pagination.
- `useProduct(id)`: Fetches a single product with variants and inventory.
- `useCart()`: Syncs cart state with backend (or local storage if unauthenticated).
- `useOrders()`: Fetches user order history.
- `useAuth()`: Wraps Supabase auth operations (signIn, signOut, getSession).

### Zustand Stores

State management structure is shared, though the implementation might differ slightly due to persistence layers (AsyncStorage vs localStorage).

- `useCartStore`: Manages optimistic cart updates, subtotal calculation, and local cart state before syncing.
- `useAuthStore`: Caches the current user session and profile data.

### What is NOT Shared (Platform-Specific)

- **UI Components**: Web uses Shadcn UI (Radix + Tailwind); Mobile uses NativeWind (Tailwind for RN) and React Native primitives (`View`, `Text`, `TouchableOpacity`).
- **Navigation**: Web uses Next.js App Router (`next/navigation`); Mobile uses Expo Router (`expo-router`).
- **Platform Integrations**: Apple Pay/Google Pay logic, Push Notification registration, Deep linking configuration.

---

## 4. Mobile-Specific Features

- **Push Notifications**:
  - Uses `expo-notifications`.
  - Categories: Order Updates (Shipped, Delivered), Promotions, Back-in-Stock alerts.
  - Tokens registered to Supabase user profile on login.
- **Deep Linking**:
  - Configured via Expo Router.
  - Universal Links (iOS) and App Links (Android) configured to open product URLs (e.g., `shop.com/product/123`) directly in the app.
- **Apple Pay / Google Pay**:
  - Integrated via `@stripe/stripe-react-native`.
  - Provides frictionless checkout experience bypassing manual card entry.
- **Haptic Feedback**:
  - Uses `expo-haptics`.
  - `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on add-to-cart, size selection, and pull-to-refresh.
- **Image Handling**:
  - Uses `expo-image` (built on Fast Image) for aggressive caching and performance.
  - Pinch-to-zoom implemented in the `ImageZoom` modal using `react-native-gesture-handler`.
- **Offline Support**:
  - TanStack Query configured with persistence (`@tanstack/react-query-persist-client` + `AsyncStorage`) to cache product lists.
  - Offline cart persistence.
  - Network status indicator using `@react-native-community/netinfo`.
- **Biometric Auth**:
  - Uses `expo-local-authentication` for FaceID/TouchID to secure the profile or speed up login.
- **Share**:
  - Uses `react-native` `Share.share()` API to invoke the native share sheet for product pages.

---

## 5. Mobile UI Components

Key reusable components built with NativeWind.

```typescript
// types/components.ts

import { ImageSourcePropType } from 'react-native';

export interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  isWishlisted: boolean;
  onPress: (id: string) => void;
  onWishlistToggle: (id: string) => void;
}

export interface ProductGridProps {
  data: ProductCardProps[];
  numColumns?: number; // default: 2
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export interface SizeSelectorProps {
  sizes: string[];
  selectedSize?: string;
  onSelect: (size: string) => void;
  outOfStockSizes?: string[];
}

export interface ColorSelectorProps {
  colors: { name: string; hex: string }[];
  selectedColor?: string;
  onSelect: (color: string) => void;
}

export interface CartItemProps {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  size: string;
  color: string;
  quantity: number;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
  onRemove: (id: string) => void;
}

export interface OrderCardProps {
  orderNumber: string;
  date: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
  total: number;
  itemCount: number;
  previewImages: string[]; // up to 3 images
  onPress: () => void;
}

export interface AddressCardProps {
  id: string;
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  isDefault?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export interface StatusTimelineProps {
  steps: { title: string; date?: string; completed: boolean }[];
  currentStepIndex: number;
}
```

---

## 6. Performance Optimization

- **FlatList Optimization**:
  - Always provide `keyExtractor`.
  - Implement `getItemLayout` for lists with fixed-height items to skip measurement calculations.
  - Tune `windowSize` (default 21, reduce to 11 or 5 for heavy items) and `maxToRenderPerBatch`.
- **Image Optimization**:
  - Use `expo-image` instead of React Native `Image`.
  - Prefetch images for the next screen (e.g., prefetch Product Detail images while on Category list).
  - Request appropriately sized thumbnails from the backend/CDN, not full-res images.
- **Bundle Size**:
  - Analyze using `@expo/metro-config` and `react-native-bundle-visualizer`.
  - Lazy load screens and heavy components.
- **Engine**:
  - Hermes JS engine enabled by default in Expo (significant startup time and memory improvements).
- **Startup Time**:
  - Use `expo-splash-screen` to keep the splash screen visible while fonts and initial essential data (like auth state) load, preventing white flashes.

---

## 7. App Store Preparation

- **EAS Build Configuration (`eas.json`)**:
  ```json
  {
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {
        "env": {
          "EXPO_PUBLIC_API_URL": "https://api.production.com"
        }
      }
    }
  }
  ```
- **App Store Metadata**: Screenshots (6.5" and 5.5" for iOS), app description, promotional text, keywords, categories.
- **Privacy Policy**: Dedicated URL outlining data collection (especially regarding Supabase Auth and Stripe).
- **Assets**: Ensure `icon.png` (1024x1024) and `splash.png` are configured in `app.json`.
- **OTA Updates**: Configured via `expo-updates` for pushing bug fixes and minor changes without full App Store review cycles.

---

## 8. Testing Strategy

- **Unit Tests**:
  - Framework: Jest + `@testing-library/react-native`.
  - Focus: Utility functions (`packages/shared/utils`), complex components (e.g., `CartItem` quantity logic), Zustand store state transitions.
- **Integration / E2E Tests**:
  - Framework: Maestro (preferred for React Native due to simpler YAML syntax and reliability) or Detox.
  - Focus: Critical paths: Login → Browse → Add to Cart → Checkout Flow.
- **Device Testing Matrix**:
  - iOS: iPhone SE (small screen check), iPhone 15 Pro (Dynamic Island/notch check).
  - Android: Pixel 7, Samsung Galaxy S24.
  - Testing performed via EAS Build internal distribution or physical devices via Expo Go during development.

# IWC: the homesick design plan

Oct 26, 2026 · @IWC · Draft for the founder

## Why us, when the store down the road is faster

We stop competing on speed and sell the thing speed can't bring: **the shelf from back home, packed in India and sent to your door.** The 1-hour and 1-day stores sell the export range, the same few brands made for the US. We sell what an Indian kirana or quick-commerce app actually stocks this week: the India pack, the state's own brands, the snack that never got exported.

That turns the wait into the proof. Seven days is how long it takes for something to really come from India, so we say it with a date, a day name and a little pride, never as an apology. The feeling we design for is a parcel from your mother: you know it's coming, you know the day, and it smells like home when you open it.

**The position in one line:** we go home so you don't have to.

Every idea below does one of three jobs: it makes the origin felt (this really is from India), makes the date certain (you know the day it lands), or makes the cost obvious (nothing extra at your door).

### The Home heading

The heading is the label under the name on Home's photo, the first words anyone reads. Six candidates, strongest first. Claude suggests **1 on Home and 2 on the 7-day store's front page**: the 7-day promise is only true for 7-day pieces, so it heads the store where it's true.

| # | Heading | The line under it | Why it lands |
| --- | --- | --- | --- |
| 1 | We go home so you don't have to. | India's shelves, at your door. | Flips the trip every NRI makes; sounds like a friend, not a shop |
| 2 | Home is 7 days away. | Order today, open it \[weekday\]. | Makes the distance feel small, and the date proves it |
| 3 | The suitcase from India, minus the suitcase. | No 23 kg limit. No customs queue. | Everyone has packed masala between their socks |
| 4 | Ghar ka saaman, ghar tak. | Things from home, to your home. | Short and singable; Hindi, so it fits some states better than others |
| 5 | Your mother's kitchen shelf ships here now. | Same packs, same labels, at your door. | Specific and a little cheeky |
| 6 | Miss home? We'll pack it. | From India to your door. | Plain and quick to read on a phone |

The current target line (D-079, "Miss local market? Start here.") gives way to whichever you pick.

## The promises we can make, and the fact behind each

We repeat seven promises and nothing else, and each one is true on the day it shows. Numbers always come from Settings or the order's own data, never typed into a page (non-negotiable 4), so changing a line in Settings changes every place it appears.

| Promise | The fact behind it | Where the number lives | Watch out for |
| --- | --- | --- | --- |
| From India to your door in 7 days | 7-day pieces arrive exactly 7 days after the order (D-148, D-154) | Settings, 7-day days (7 to 7) | Say the date and the weekday, not "fast" |
| Everything else in 12 to 16 days | The standard window (D-154) | Settings, delivery days | Show it as dates ("Nov 7 to Nov 11") |
| Free 7-day delivery from $49.99 | A bag of only 7-day pieces at the 7-day line ships free (D-154) | Settings, Bag charges | Only for a bag of only 7-day pieces |
| Free delivery from $99.99 | The free-shipping line on production | Settings, Bag charges | Below the line, Shipping and Retailer charges show |
| Nothing to pay at your door | US duty is paid out of our margin (founder, Oct 2026); the courier delivering duty-paid is still to confirm | the pricing rules | Say "duties paid", never "no tariffs" (decision 3) |
| Right to your door | Every order ships to the customer's address | the order | No pickup points, no store visit |
| The pack from back home | Every piece is bought in India's own shops (said in general, no shop ever named: decision 1), so it is the India pack, with its own label and script | the listing's photos | About the pack only; the rupee price on it is never mentioned (decision 6) |

Two of these carry most of the weight: **the date** (it answers "when") and **duties paid** (it answers "why does it cost more than in India"). Show those two the most.

## Where each promise sits

**One promise per screen, at the moment it answers the customer's question.** The customer should meet each promise many times without ever reading a block of text about it. The rule: a promise lives inside something the page already has (a header line, a card tag, a button, the free-delivery bar), never in a new banner, pop-up or paragraph.

| Moment | What they're wondering | What they see | Lives in |
| --- | --- | --- | --- |
| First second on Home | "What is this place?" | Under the name: "We go home so you don't have to." | Home hero label (D-079's line, rewritten) |
| Any page, top | "Is this the slow one?" | The store tabs already say "7-day store · arrives by Sat, Oct 31"; the IWC tab gets the same: "Everything from India · at your door by Nov 11" | Store tabs (D-156) |
| Scrolling cards | "When would this one come?" | 7-day cards: "Sat at your door" instead of "In 7 days" (a weekday beats a number) | Card tag (D-148) |
| Product page | "Will it really come from India?" | Origin line "Made in Kerala, packed in India" + the date line + "Duties paid. Nothing to pay at your door." | Origin and delivery lines (D-004, D-148) |
| Add to bag | "Did it work?" | The photo flies to the bag (D-116) and a one-line toast: "Coming home Sat, Oct 31" | Fly-to-bag |
| Bag | "How much more for free delivery?" | The free-delivery bar becomes a flight path, India to your door: "$12.40 more and the flight's on us" | Free-delivery bar (D-156) |
| Checkout | "What will I pay at the door?" | One quiet line under the total: "That's everything. Duties are paid, nothing at your door." | Checkout summary |
| Thank-you page | "Now what?" | A calendar card: "At your door Sat, Oct 31" with Add to calendar | Checkout success |
| The wait | "Where is it?" | The parcel diary (idea 2) and the emails we already send, rewritten (idea 12); no new emails | Order page, emails |
| Arrival | "That was nice" | A state postcard in the box (idea 7) and a one-tap reorder | The parcel, the order page |

Pages we leave alone: account, login, policies and the admin. Customers go there to do a job, not to be reminded.

## New ideas: make the wait part of the gift

Twelve ideas, each small on its own; no new emails, and the parcel diary is the only new page. Together they make a 7-day wait feel like a parcel from home instead of a slow shop.

1. **Day names, not durations.** Every delivery mention becomes a weekday and a date from data: "Order today, open it Saturday." A Saturday order lands the next Saturday, so the line on weekends reads "Order this weekend, cook with it next weekend." People plan around days, not around "7 days".
2. **The parcel diary.** The order page becomes a short diary, one line a day from order to door: "Day 1: packed." "Day 4: halfway." "Day 7: today, at your door." Plain progress, no tracking codes. Its wording waits on decision 2.
3. **Where's home?** One tap on the India map on the first visit, remembered on the device. The site then greets them in their state's own script (the greeting data is already in every region), puts their state's pieces first, and fills the 7-day front page's missing "From your state" row.
4. **The flight-path bar.** The free-delivery bar is drawn as the running stitch from the India outline in our logo to a little house. It fills as the bag grows: "$12.40 more and the flight's on us."
5. **India time.** One quiet line in the menu: "It's 9:40 pm in India." with a line for the hour (morning chai, the evening rush, the late-night cricket replay). Costs nothing to run and says "we're over there" without a word about shipping.
6. **The festival clock.** For the next two or three festivals only, the last day to order: "Diwali is Sun, Nov 8. Order 7-day pieces by Sun, Nov 1." Worked out from the festival date and the 7-day days, so it is never fake urgency. Lakshmi Puja falls on Sun, Nov 8, 2026 ([BankBazaar](https://www.bankbazaar.com/indian-holiday/lakshmi-puja-holiday.html)); the 12 to 16 day window has already missed it, so this Diwali only the 7-day store can deliver, once its deploy is out.
7. **The state postcard.** A printed card in every parcel: the state's greeting in its own script, one line about the state, a QR code to reorder or leave a review. The words already exist for all 36 states.
8. **Postmarks in the bag.** Each bag line wears its state's postmark (the stamps exist), and checkout says "Your parcel carries 3 postmarks: Kerala, Punjab, Gujarat."
9. **The kirana counter.** The "Under $5" row restyled as a shop counter: "Parle-G to Pulse, under $5." Small treats that top a bag up to the free line.
10. **Cook it next Sunday.** Four to six recipe baskets the founder picks, such as everything for rajma chawal in one tap. Order by Sunday, cook it next Sunday.
11. **The India pack line.** One line on product pages: "The pack sold in India, label and all." The printed rupee price is never mentioned (decision 6).
12. **Our emails, rewritten.** No new emails: the ones we already send (thank you, getting it ready, on its way, delivered, and the sorry ones) get the same warmth as the site, each with its date and one human line. The full set is in The words.

The chart below places them by how much they'd move a homesick buyer and how much work they are. These positions are Claude's estimate, not measured.

&#91;embedded content: the twelve ideas · impact against effort\]

The shaded corner is the first build: six changes to things the site and its emails already have, no new pages.

## The words

Every screen and every email gets one line with a pulse. All drafts until the founder approves them (D-019, D-059). Brackets are filled from data when the page shows: dates, amounts, states, names. Money lines stay plain; the warmth goes around them, never into the price.

### Home and the top of every page

| Where | Draft line |
| --- | --- |
| Home heading | We go home so you don't have to. |
| Under it | India's shelves, at your door. |
| 7-day front page heading | Home is 7 days away. |
| Under it | Order today, open it \[Sat, Nov 7\]. |
| Store tab, IWC | Everything from India · at your door by \[Nov 11\] |
| Store tab, 7-day | Home in 7 days · \[Saturday\] at your door |
| Where's home? (first visit) | Where's home? Tap your state and we'll put its shelf first. |
| After they pick | \[Vanakkam\], \[Tamil Nadu\]. Your shelf is up front now. |
| Coming back | \[Kerala\]'s shelf missed you. |
| Footer line | Made in India. Duties paid. At your door. |

### Browsing

| Where | Draft line |
| --- | --- |
| 7-day card tag | \[Sat\] at your door |
| Just listed row | Fresh off the shelf in India |
| Most ordered this week | What everyone missed this week |
| Kirana counter (Under $5) | The kirana counter. Under $5, and no toffees for change. |
| Search box | Parle-G? Kasuri methi? That one pickle? |
| Search, nothing found | Not on our shelf yet. Tell us what you miss and we'll go looking. |
| Sold out | Sold out. Someone missed home faster than you. |
| Filters, nothing left | Nothing matches. Even Mumbai traffic moves more than this. Loosen a filter? |
| Weekend line (Fri to Sun) | Order this weekend, cook with it next weekend. |
| Festival clock | Diwali is Sun, Nov 8. 7-day pieces ordered by Sun, Nov 1 get there in time. |
| Festival, last day | Last day for Diwali: 7-day pieces ordered today get there in time. |

### The product page

| Where | Draft line |
| --- | --- |
| Origin line | Made in \[Kerala\]. Bought there, sent from there. |
| Delivery line | At your door \[Sat, Nov 7\] if you order today. |
| Under the price | Duties paid. Nothing to pay at your door. |
| The India pack line | The pack sold in India, label and all. |
| Add to bag, after the tap | Packed. |
| The toast | Coming home \[Sat, Nov 7\]. |
| Goes well with | Your mother would add these too. |
| Reviews, none yet | No reviews yet. Be the first to say "just like home". |

### The bag

| Where | Draft line |
| --- | --- |
| Empty bag | Lighter than a tiffin. Let's fix that. |
| Empty bag, second line | Your mother would be worried. |
| Free-delivery bar, below the line | \[$12.40\] more and the flight's on us. |
| Past the line | The flight's on us. |
| Past the line, the bulk saving | Past the line, so \[$3.20\] comes off too. It grows to $25. |
| 7-day bar, below the line | \[$8.10\] more for free 7-day delivery. |
| 7-day bar, past the line | Free 7-day delivery. Home by \[Saturday\]. |
| Two parcels | Two parcels: the 7-day ones land \[Sat, Nov 7\], the rest by \[Nov 11\]. |

### Checkout and the thank-you page

| Where | Draft line |
| --- | --- |
| Delivery step heading | Where should we bring home? |
| Under the total | That's everything. Duties are paid, nothing at your door. |
| While paying | Packing your parcel… |
| Thank-you heading | It lands \[Sat, Nov 7\]. Clear a shelf. |
| Under it | We'll write when it's on its way. No spam, promise. |
| Calendar event | Home arrives (IWC order \[number\]) |

### The parcel diary (the order page)

One line per step, shown only when the order really reaches it, each with its date.

| Step | Draft line |
| --- | --- |
| Ordered | Your list is with us. |
| Getting it ready | Getting everything together for you. |
| On its way | On its way. Your parcel's somewhere between here and home. |
| At your door | Home has landed. Keep the scissors near. |
| After delivery | How did it taste? Be honest, we can take it. |

### Our emails (the ones we already send, no new ones)

| Email | Subject | First line |
| --- | --- | --- |
| Order confirmation | Home's on the way: order \[number\] | It lands \[Sat, Nov 7\]. We'll write once more when it's on its way. |
| Getting it ready | We're packing order \[number\] | Your list is with us. Still landing \[Sat, Nov 7\]. |
| On its way | Order \[number\] is on its way home | Out the door and headed to yours. At your door \[Sat, Nov 7\]. |
| Delivered | Home has landed | Your parcel is at your door. We hope it smells right. |
| A piece unavailable | One piece couldn't make the trip | \[Name\] has sold out. You won't pay for it, and everything else is still coming. |
| Refund | Your money's on its way back | \[$4.20\] is going back to your card. Banks take 5 to 10 days. We wish they didn't. |
| Cancelled | Order \[number\] is cancelled | Done, and \[$64.20\] is on its way back. We'll be here next time you miss home. |
| New, later date | New date for order \[number\]. Sorry. | It now lands \[Nov 14\], later than we said. That's on us. Keep it or cancel for a full refund. |
| Coming sooner | Plot twist: order \[number\] is early | It's arriving ahead of the date we gave you. |
| Return | We'll come to your door for it | We got your return request. We'll collect it from your door, just like the delivery. |
| Sign-off on every email | From our home to yours, the IWC team |  |

### Small moments

| Where | Draft line |
| --- | --- |
| Page not found | This page went home and didn't come back. Happens to the best of us. |
| Something broke | Something cracked, like a papad. Try again? |
| Signing in | Welcome back. Your saved pieces kept your seat. |
| Saved on this device | Saved here. Sign in and it follows you everywhere. |

### India time, one line by the hour in India

| Hours in India | Draft line |
| --- | --- |
| 5 to 7 am | Somewhere a pressure cooker just whistled. |
| 7 to 9 am | Chai's on. Someone's reading the paper out loud. |
| 9 am to noon | Horns, tiffins and the school bus. |
| Noon to 3 pm | Lunch, then the nap nobody admits to. |
| 4 to 6 pm | Chai and samosa o'clock. |
| 6 to 8 pm | Temple bells and the evening walk. |
| 8 to 10 pm | Dinner, and the TV serial everyone pretends not to watch. |
| 10 pm to 1 am | Cricket highlights and one last chai. |
| 1 to 5 am | India's asleep. Even the street dogs. |

### The postcard in every parcel

| Side | Draft line |
| --- | --- |
| Front | The state's photo and its greeting in its own script: \[ನಮಸ್ಕಾರ\] |
| Back | \[Namaskara\] from \[Karnataka\]. Liked it? Scan to order again, or tell us what to bring next. |

The only line that nods at the fast stores is gone. Every line now talks about home and us, never about them.

## Guard rails

The plan works only if it stays quiet. These hold for every idea above.

- **No new banners, pop-ups or tickers.** A promise rides on something the page already has. If a screen needs a second promise to work, the first one is in the wrong place.
- **No fake urgency.** No countdown timers, no "only 2 left" unless the stock really says 2, no festival line without a real date (the Voice rules, D-008).
- **Every date and amount comes from data.** Settings, the order, the cycle. Change Settings and every line changes with it.
- **Not a blog.** No articles, no long state stories on shopping pages. A line, a stamp, a date.
- **Speed stays a feature.** No new library. Animations are CSS only and off with reduced motion. Personal touches (Where's home, India time) run in the browser after the page loads, so store pages stay cached and the 150 KB budget holds (PR-1, PR-5).
- **Nothing about operations.** "Bought in India's own shops" is said in general only; no shop, hub, city, route, weight or rupee price on a customer screen or email (D-003, decisions 1, 2 and 6).
- **Phones first.** Each line is checked at 375 px before it ships.

## Decisions, settled on Oct 26

The founder took Claude's suggestion on the first five and said no on the sixth. These go into `docs/decisions.md` with phase 1.

1. **"Straight from Indian shops":** we say "bought in India's own shops" in general and never name one. D-003 still holds for every shop, source and route.
2. **The diary:** plain steps (ordered, getting it ready, on its way, at your door). No cities, hubs or customs.
3. **Tariffs:** "Duties paid. Nothing to pay at your door." Never "no tariffs". Still to confirm with the courier: no fee at the door.
4. **The weekend:** the real weekday everywhere; no weekend promise until a carrier offers a Saturday delivery day (Q-3).
5. **The state postcard:** yes. The India side prints and packs one per parcel.
6. **The rupee price on the pack:** never mentioned.
7. **Emails:** no new ones. The emails we already send are rewritten (idea 12).

## Build order

**Diwali sets the first deadline: 7-day orders must be in by Sun, Nov 1.** So the first phase is the new heading, the words and dates on things that already exist, and the rewritten emails, shipped this week once the Deploy workflow has put the 7-day store live. Efforts are Claude's estimates.

| Phase | What | Effort | Cost against the free limits |
| --- | --- | --- | --- |
| 1. This week | Ideas 1, 6 and 12: the new heading and every line in The words, emails included | 3 to 4 days | One store refresh at deploy; no new queries |
| 2. Next week | Ideas 4, 8, 9 (flight-path bar, postmarks, kirana counter) | 3 to 4 days | None: CSS and data the pages already carry |
| 3. November | Ideas 3, 5, 11 (Where's home, India time, the India pack line) | 4 to 5 days | None: runs in the browser, pages stay cached |
| 4. November | Idea 2 (the parcel diary) | 3 to 4 days | None: the order page is already dynamic, and no new emails |
| 5. When ready | Ideas 7, 10 (postcard, recipe baskets) | India-side printing; the founder picks the baskets | None on the site |

With the decisions settled, phase 1 records them as a decision in `docs/decisions.md` and rules in `docs/storefront.md`, then builds. The heading waits for your pick from The Home heading.

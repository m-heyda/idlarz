# Gem economy sim (IDL-229)

Faucets against the gem shop's price book (`src/config/gemShop.ts`), written by `npm run gem-sim -- --md`. Everything is an expectation (no dice), so a price or faucet edit changes these numbers and shows in review. Gems earned here do **not** include the 1,000-gem start purse: it is a gift, not a spending budget (docs/plan/30 section 9).

## Faucets per day

Chests: a chest ticket every 720 s at Luck 0 (faster with Luck, never below half), a gem roll on each (`min(15%, 3% + 0.06% x Luck)`) of 19.9 gems on average (`LUCK.gem`, 5-50, skewed low). Daily bonus: 20, 25, 30, 35, 40, 45, 50 gems over a 7-day streak (35.0 a day when claimed every day, 20 per claim when the streak never builds).

| Profile | Luck | Chests picked up | Daily bonus | Chest gems / day | Daily gems / day | Total / day |
|---|---:|---:|---|---:|---:|---:|
| Casual | 0 | 50% | every 2 days | 36 | 10 | 46 |
| Regular | 100 | 50% | every day | 172 | 35 | 207 |
| Dedicated | 300 | 100% | every day | 715 | 35 | 750 |

### Chest gems per day, Luck against how many chests are picked up

| Luck | 50% of chests | 100% of chests |
|---:|---:|---:|
| 0 | 36 | 72 |
| 100 | 172 | 343 |
| 300 | 358 | 715 |

## One-off pools

Achievement and deed tiers: **27,600** gems (the manual tester marks excluded). Deed milestones: **2,800**. Bestiary mastery (monster and boss ladders plus biome goals): **1,380**, but each tier needs hundreds to thousands of kills of one type, so it is left out of the horizons below. The share of the first two a player has claimed by a day is a guess (`CLAIMED_SHARE`): day 7: 5%, day 30: 20%, day 90: 45%, day 180: 70%.

## Gems earned by day

| Profile | Day 7 | Day 30 | Day 90 | Day 180 |
|---|---:|---:|---:|---:|
| Casual | 1,840 | 7,453 | 17,798 | 29,516 |
| Regular | 2,966 | 12,279 | 32,276 | 58,471 |
| Dedicated | 6,770 | 28,582 | 81,186 | 156,293 |

## The price book against the faucets

The day a player has earned the price (alone, with nothing else bought first). **Cap Breaks are planned, not built** (docs/plan/30 section 4): they are priced here from the plan to check it, and are left out of the whole-list total.

| Item | Tab | Price | Casual | Regular | Dedicated |
|---|---|---:|---:|---:|---:|
| Change class | identity | 500 | 2 | 2 | 1 |
| Change name | identity | 200 | 1 | 1 | 1 |
| Respec attributes | identity | 300 | 2 | 1 | 1 |
| Name colours | identity | 1,000 | 4 | 3 | 2 |
| Rainbow name | once | 500 | 2 | 2 | 1 |
| Aurora name | once | 500 | 2 | 2 | 1 |
| Ember name | once | 500 | 2 | 2 | 1 |
| Frost name | once | 500 | 2 | 2 | 1 |
| Void name | once | 500 | 2 | 2 | 1 |
| Galaxy name | once | 500 | 2 | 2 | 1 |
| Ice Lotus | once | 2,500 | 10 | 6 | 3 |
| Ring Fortress | once | 2,500 | 10 | 6 | 3 |
| Crimson Gothic | once | 2,500 | 10 | 6 | 3 |
| Red Pagoda | once | 2,500 | 10 | 6 | 3 |
| Stone Keep | once | 2,500 | 10 | 6 | 3 |
| Golden Palace | once | 2,500 | 10 | 6 | 3 |
| Crystal Citadel | once | 2,500 | 10 | 6 | 3 |
| Jewel Palace | once | 2,500 | 10 | 6 | 3 |
| Ember Fortress | once | 2,500 | 10 | 6 | 3 |
| Prism Spire | once | 2,500 | 10 | 6 | 3 |
| Emerald Keep | once | 2,500 | 10 | 6 | 3 |
| Tidal Keep | once | 2,500 | 10 | 6 | 3 |
| Moonlit Cathedral | once | 2,500 | 10 | 6 | 3 |
| Additional builder 1 | upgrades | 2,000 | 8 | 5 | 3 |
| Additional builder 2 | upgrades | 6,000 | 25 | 15 | 7 |
| Additional builder 3 | upgrades | 12,000 | 57 | 30 | 13 |
| Master Workbench | upgrades | 1,500 | 6 | 4 | 2 |
| Overnight Orders | upgrades | 1,000 | 4 | 3 | 2 |
| Building Slot | upgrades | 6,000 | 25 | 15 | 7 |
| Bulk Discount | upgrades | 1,500 | 6 | 4 | 2 |
| Cap Break 1 (per ladder, x5 ladders) (planned) | planned | 300 | 2 | 1 | 1 |
| Cap Break 2 (per ladder, x5 ladders) (planned) | planned | 750 | 3 | 2 | 1 |
| Cap Break 3 (per ladder, x5 ladders) (planned) | planned | 1,875 | 8 | 5 | 2 |

**Whole shop today: 67,500 gems** = day 1011 (Casual), 224 (Regular), 75 (Dedicated). Planned Cap Breaks on every ladder add 14,625 gems.

## Targets (docs/plan/30 section 9)

| Target | Result | Detail |
|---|---|---|
| An identity item is affordable in the first week (earnings only, Regular) | ok | Change name (200 gems) on day 1 |
| The first upgrade (QoL) is affordable in week 2 (Regular) | ok | Overnight Orders (1000 gems) on day 3 |
| A first Cap Break is not out of reach before week 8 (the rebirth gate decides the day; planned, Regular) | ok | 300 gems on day 1 |
| The whole shop is a multi-month goal for Regular (90+ days) and still finite for Dedicated | ok | 67,500 gems: Regular day 224, Dedicated day 75 |
| No item takes the whole 1000-gem start purse on day 1 (price within 80-100% of it) | **watch** | Name colours (1000), Overnight Orders (1000) |


---
name: grab-food
version: 2
description: Browse nearby restaurants and menus on GrabFood via the undocumented portal.grab.com API. Use when the user wants to list nearby restaurants, search for food, or view a merchant's menu and items.
agents: [main_agent, general_purpose]
---

# GrabFood skill

Talks to GrabFood's internal API at `portal.grab.com`. Auth uses 3 cookies from Grab's SSO, stored in `~/.grab-food/cookies.json` (never committed).

## One-time setup

Run the init script:

```bash
node scripts/init-cookies.mjs
```

**Agent flow:**
1. Run `node scripts/init-cookies.mjs`
2. Tell the user: "Open https://food.grab.com, DevTools F12, Application, Cookies, portal.grab.com. Copy the 3 cookie values and paste them in."
3. The script saves to `~/.grab-food/cookies.json` and checks they work.

Non-interactive:
```bash
node scripts/init-cookies.mjs "grabid-openid-authn-ck=...; passenger_authn_token=...; passenger_authn_token_jti=..."
```

Check existing cookies:
```bash
node scripts/init-cookies.mjs --verify
```

Env var fallback:
```bash
export GRAB_COOKIES="grabid-openid-authn-ck=...; passenger_authn_token=...; ..."
```

## When cookies expire

`--verify` fails or the script returns 401/403. Do not try to decode or generate tokens yourself. Ask the user to re-run:

```bash
node scripts/init-cookies.mjs
```

## Endpoints

### Nearby restaurants

```
GET https://portal.grab.com/foodweb/guest/v2/category
  ?latlng=<lat>,<lng>
  &categoryShortcutID=<id>
  &offset=<n>
  &pageSize=<n>
```

`categoryShortcutID` `5047` is the default nearby view.

Response: `searchResult.searchMerchants[]` has:
- `id` (`5-C8BKRET2ETDDJ6`)
- `merchantBrief.merchantName`, `cuisine[]`, `distanceInKm`, `rating`, `vote_count`
- `estimatedDeliveryTime`, `estimatedDeliveryFee.priceDisplay`
- `promo.hasPromo`, `displayInfo.additionalText`

### Merchant menu

```
GET https://portal.grab.com/foodweb/guest/v2/merchants/<merchantID>
  ?latlng=<lat>,<lng>
```

Response: `merchant` has:
- `name`, `cuisine`, `address.combined_address`, `address.city`
- `menu.categories[]` with `items[]` (`name`, `priceInMinorUnit` (VND x 1000), `description`)

## Helper script

```bash
# List nearby restaurants
node scripts/grab-food.mjs nearby "LAT,LNG"

# Paginate
node scripts/grab-food.mjs nearby "LAT,LNG" --offset=32 --pageSize=32

# Get full menu
node scripts/grab-food.mjs menu "5-C8BKRET2ETDDJ6" "LAT,LNG"

# Dump raw JSON
node scripts/grab-food.mjs nearby "LAT,LNG" --raw
```

Via npx:

```bash
npx @hoangvu12/grab-food nearby "LAT,LNG"
```

(npx needs `GRAB_COOKIES` env var.)
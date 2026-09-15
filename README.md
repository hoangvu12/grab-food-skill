# GrabFood CLI

Look up nearby restaurants and menus on GrabFood from your terminal.

```bash
npx @hoangvu12/grab-food nearby "LAT,LNG"
```

Pick up to:
- nearby restaurants sorted by distance, with ratings, ETA, fees, promos
- full menus with item names, prices, descriptions
- pagination through hundreds of results
- raw JSON output

## Setup

You need 3 cookies from `food.grab.com`. They last a month or two.

### Interactive

```bash
node scripts/init-cookies.mjs
```

The script asks you to login to food.grab.com in your browser, copy the cookies from DevTools, and paste them back.

### Manual

```bash
export GRAB_COOKIES="grabid-openid-authn-ck=...; passenger_authn_token=...; passenger_authn_token_jti=..."
```

## Usage

```bash
# First page of restaurants
node scripts/grab-food.mjs nearby "LAT,LNG"

# Next page
node scripts/grab-food.mjs nearby "LAT,LNG" --offset=32 --pageSize=32

# Menu for a merchant
node scripts/grab-food.mjs menu "5-C8BKRET2ETDDJ6" "LAT,LNG"

# Raw response
node scripts/grab-food.mjs nearby "LAT,LNG" --raw
```

Via npx:

```bash
npx @hoangvu12/grab-food nearby "LAT,LNG"
```

npx needs the `GRAB_COOKIES` env var because `~/.grab-food/cookies.json` is a local path.

## How it works

This calls GrabFood's internal API at `portal.grab.com` with session cookies. No API key. No login. Two endpoints:

- `GET /foodweb/guest/v2/category` -- paginated nearby results
- `GET /foodweb/guest/v2/merchants/:id` -- merchant menu

## When cookies expire

```bash
node scripts/init-cookies.mjs
```

Or check first:

```bash
node scripts/init-cookies.mjs --verify
```

## License

MIT
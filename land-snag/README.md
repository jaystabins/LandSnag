# LandSnag - Local-First Real Estate Map Search

A real estate map search application built with Next.js, Prisma, and Leaflet.

## Features

- Full-screen interactive map using Leaflet.
- Bounding box search (automatically updates as you pan/zoom).
- Polygon draw search (filter properties within a custom drawn area).
- Property markers with detail popups.
- Local-first architecture using SQLite.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: SQLite
- **ORM**: Prisma (Version 5 for stable SQLite support)
- **Map**: React-Leaflet & Leaflet Draw
- **Language**: TypeScript

## Setup Instructions

1. **Clone the repository** (if applicable).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up the database**:
   Initialize the SQLite database and run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
4. **Seed the data**:
   Generate 200 mock properties:
   ```bash
   node prisma/seed.js
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```
6. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Data Model

The `Property` model includes:
- `id`: Unique identifier (CUID)
- `latitude` / `longitude`: Coordinates
- `price`: Property price
- `address`, `city`, `state`, `zip`: Location details
- `propertyType`: RESIDENTIAL or LAND
- `lotSize`: Size in acres (optional)

## Architecture

- Data access is isolated in `src/lib/data` for easy swapping of database providers.
- Custom `isPointInPolygon` utility in `src/lib/geo-utils.ts` handles spatial filtering in-memory for SQLite.
- Clean separation between API, Data, and Frontend layers.

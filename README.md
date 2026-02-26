# LandSnag - Local-First, Provider-Agnostic Map Search

A real estate research and map search application built for speed, resiliency, and ease of expansion. LandSnag prioritizes local data with a smart caching layer and a modular provider system.

## 🚀 Key Features

- **Interactive Map Search**: Full-screen exploration using Leaflet with automatic bounding box updates.
- **Advanced Spatial Filtering**: Draw custom polygons to filter land parcels and properties.
- **Modular Provider Registry**: Easily integrate multiple external APIs (tax sales, MLS, mock data) through a unified service layer.
- **Smart Caching & Resilience**: 
  - TTL-based caching logic to ensure data freshness.
  - Automatic fallback to local cache if external providers fail.
  - Batch-optimized upserts for high-performance data ingestion.
- **Property Research Toolkit**:
  - Save properties and track their status (SAVED, CONTACTED, etc.).
  - Add personal notes to properties and specific counties.
- **Modern Tech Stack**: Strictly typed with TypeScript and validated with Zod.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [SQLite](https://www.sqlite.org/) (via [LibSQL](https://github.com/tursodatabase/libsql))
- **ORM**: [Prisma](https://www.prisma.io/)
- **Mapping**: [React-Leaflet](https://react-leaflet.js.org/) & [Leaflet Draw](https://github.com/Leaflet/Leaflet.draw)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Styling**: Vanilla CSS (Modern CSS variables)

## 🚦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Database Setup
Sync the schema and generate the Prisma client:
```bash
npx prisma generate
npx prisma db push
```

### 3. Seed Mock Data (Optional)
Populate your local database with mock listings for development:
```bash
node prisma/seed.js
```

### 4. Run Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) to see the app.

### 5. Running Tests
Execute the unit test suite:
```bash
npm test
```

## 🏗️ Architecture

- **`src/lib/services/PropertyService.ts`**: The core business engine. Handles provider orchestration, caching logic, and spatial filtering.
- **Provider Registry**: Found in `src/lib/services/providerRegistry.ts`. Allows swapping or adding new data sources without changing application logic.
- **Normalization Layer**: `PropertyMapper.ts` uses Zod to ensure all external data is sanitized and normalized before entering the system.
- **Spatial Utility**: `src/lib/geo-utils.ts` implements in-memory Ray Casting for polygon containment, enabling complex spatial searches on top of standard SQLite.

## 📊 Data Model

- **`Property`**: Core record with location, price, and automated "freshness" tracking (`lastFetchedAt`).
- **`SavedProperty`**: User-specific tracking and status.
- **`PropertyNote` / `CountyNote`**: Flexible research annotations.

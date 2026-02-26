'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="map-container">Loading map...</div>,
});

export default function Home() {
  return (
    <main>
      <MapView />
    </main>
  );
}

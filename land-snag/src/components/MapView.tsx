'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, FeatureGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue in Next.js
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Import Leaflet.draw
if (typeof window !== 'undefined') {
    require('leaflet-draw');
}

interface PropertyFeature {
    id: string;
    properties: {
        id: string;
        price: number;
        address: string;
        city: string;
        state: string;
        zip: string;
        propertyType: string;
        lotSize: number | null;
    };
    geometry: {
        coordinates: [number, number];
    };
}

function MapSearchHandler({ onBBoxChange }: { onBBoxChange: (bbox: string) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const bounds = map.getBounds();
            const bbox = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
            onBBoxChange(bbox);
        },
    });

    useEffect(() => {
        // Initial load
        const bounds = map.getBounds();
        const bbox = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        onBBoxChange(bbox);
    }, []);

    return null;
}

function DrawHandler({ onPolygonDraw }: { onPolygonDraw: (polygon: string | null) => void }) {
    const map = useMap();
    const featureGroupRef = useRef<L.FeatureGroup>(null);

    useEffect(() => {
        const drawControl = new (L.Control as any).Draw({
            draw: {
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
                rectangle: true,
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                },
            },
            edit: {
                featureGroup: featureGroupRef.current,
                remove: true,
            },
        });

        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, (e: any) => {
            const layer = e.layer;
            featureGroupRef.current?.clearLayers();
            featureGroupRef.current?.addLayer(layer);

            const latlngs = layer.getLatLngs()[0];
            const polygonCoords = latlngs.map((ll: any) => `${ll.lng},${ll.lat}`).join(';');
            onPolygonDraw(polygonCoords);
        });

        map.on(L.Draw.Event.DELETED, () => {
            onPolygonDraw(null);
        });

        return () => {
            map.removeControl(drawControl);
            map.off(L.Draw.Event.CREATED);
            map.off(L.Draw.Event.DELETED);
        };
    }, [map, onPolygonDraw]);

    return <FeatureGroup ref={featureGroupRef} />;
}

import PropertyDetailsPanel from './PropertyDetailsPanel';

export default function MapView() {
    const [properties, setProperties] = useState<PropertyFeature[]>([]);
    const [bbox, setBBox] = useState<string | null>(null);
    const [polygon, setPolygon] = useState<string | null>(null);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    useEffect(() => {
        const fetchProperties = async () => {
            let url = '/api/properties/search';
            if (polygon) {
                url += `?polygon=${polygon}`;
            } else if (bbox) {
                url += `?bbox=${bbox}`;
            }

            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.features) {
                    setProperties(data.features);
                }
            } catch (err) {
                console.error('Fetch error:', err);
            }
        };

        const debounceTimer = setTimeout(() => {
            if (bbox || polygon) {
                fetchProperties();
            }
        }, 400);

        return () => clearTimeout(debounceTimer);
    }, [bbox, polygon]);

    return (
        <div className={`main-layout ${selectedPropertyId ? 'panel-open' : ''}`}>
            <div className="map-view-container">
                {polygon && (
                    <div className="draw-controls">
                        <button className="btn-clear" onClick={() => window.location.reload()}>
                            Clear Search
                        </button>
                    </div>
                )}
                <MapContainer
                    center={[35.2271, -80.8431]}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapSearchHandler onBBoxChange={setBBox} />
                    <DrawHandler onPolygonDraw={setPolygon} />
                    {properties.map((p) => (
                        <Marker
                            key={p.id}
                            position={[p.geometry.coordinates[1], p.geometry.coordinates[0]]}
                            eventHandlers={{
                                click: () => setSelectedPropertyId(p.id)
                            }}
                        >
                            <Popup>
                                <div className="property-popup">
                                    <p className="property-price">${p.properties.price.toLocaleString()}</p>
                                    <h3>{p.properties.address}</h3>
                                    <button
                                        className="btn-view-details"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setSelectedPropertyId(p.id);
                                        }}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            <PropertyDetailsPanel
                propertyId={selectedPropertyId}
                onClose={() => setSelectedPropertyId(null)}
            />
        </div>
    );
}

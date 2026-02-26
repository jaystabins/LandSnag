'use client';

import { useState, useEffect } from 'react';

interface Note {
    id: string;
    content: string;
    createdAt: string;
}

interface SavedProperty {
    id: string;
    status: string;
    personalRating: number | null;
}

interface PropertyDetails {
    id: string;
    address: string;
    city: string;
    county: string | null;
    state: string;
    zip: string;
    price: number;
    propertyType: string;
    lotSize: number | null;
    source: string;
    savedProperties: SavedProperty[];
    notes: Note[];
}

export default function PropertyDetailsPanel({
    propertyId,
    onClose
}: {
    propertyId: string | null;
    onClose: () => void;
}) {
    const [details, setDetails] = useState<PropertyDetails | null>(null);
    const [countyNote, setCountyNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [newNote, setNewNote] = useState('');

    useEffect(() => {
        if (propertyId) {
            fetchDetails();
        } else {
            setDetails(null);
        }
    }, [propertyId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/properties/${propertyId}`);
            if (!res.ok) {
                setDetails(null);
                return;
            }
            const data = await res.json();
            setDetails(data);

            if (data.county && data.state) {
                fetchCountyNote(data.county, data.state);
            }
        } catch (err) {
            console.error('Failed to fetch details:', err);
            setDetails(null);
        } finally {
            setLoading(false);
        }
    };
    const fetchCountyNote = async (county: string, state: string) => {
        try {
            const res = await fetch(`/api/counties/notes?county=${county}&state=${state}`);
            const data = await res.json();
            setCountyNote(data.content || '');
        } catch (err) {
            console.error('Failed to fetch county note:', err);
        }
    };

    const saveCountyNote = async () => {
        if (!details?.county) return;
        try {
            await fetch('/api/counties/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    county: details.county,
                    state: details.state,
                    content: countyNote
                })
            });
            alert('County note saved!');
        } catch (err) {
            console.error('Failed to save county note:', err);
        }
    };

    const toggleSave = async () => {
        try {
            await fetch(`/api/properties/${propertyId}`, { method: 'POST' });
            fetchDetails();
        } catch (err) {
            console.error('Failed to toggle save:', err);
        }
    };

    const updateStatus = async (status: string) => {
        try {
            await fetch(`/api/properties/${propertyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchDetails();
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    const addNote = async () => {
        if (!newNote.trim()) return;
        try {
            await fetch(`/api/properties/${propertyId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newNote })
            });
            setNewNote('');
            fetchDetails();
        } catch (err) {
            console.error('Failed to add note:', err);
        }
    };

    if (!propertyId) return null;

    return (
        <div className={`details-panel ${propertyId ? 'open' : ''}`}>
            <div className="panel-header">
                <h2>Property Research</h2>
                <button className="btn-close" onClick={onClose}>×</button>
            </div>

            {loading ? (
                <div className="panel-loading">Loading details...</div>
            ) : details ? (
                <div className="panel-content">
                    <div className="detail-section">
                        <h3>{details.address}</h3>
                        <p className="price">${details.price?.toLocaleString() ?? 'N/A'}</p>
                        <p>{details.city}, {details.county && `${details.county} County, `}{details.state} {details.zip}</p>
                        <p><strong>Type:</strong> {details.propertyType}</p>
                        {details.lotSize && <p><strong>Lot Size:</strong> {details.lotSize.toFixed(2)} acres</p>}
                        <p className="source-tag">Source: {details.source}</p>
                    </div>

                    <div className="detail-section workflow-actions">
                        <button
                            className={`btn-save ${details.savedProperties.length > 0 ? 'saved' : ''}`}
                            onClick={toggleSave}
                        >
                            {details.savedProperties.length > 0 ? '★ Saved' : '☆ Save Property'}
                        </button>

                        {details.savedProperties.length > 0 && (
                            <div className="status-selector">
                                <label>Research Status:</label>
                                <select
                                    value={details.savedProperties[0].status}
                                    onChange={(e) => updateStatus(e.target.value)}
                                >
                                    <option value="SAVED">Saved</option>
                                    <option value="CONTACTED">Contacted</option>
                                    <option value="OFFERED">Offered</option>
                                    <option value="REJECTED">Rejected</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="detail-section notes-section">
                        <h3>Property Notes</h3>
                        <div className="note-input">
                            <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add a research note for this specific property..."
                            />
                            <button onClick={addNote}>Add Property Note</button>
                        </div>
                        <div className="notes-list">
                            {details.notes.map(note => (
                                <div key={note.id} className="note-card">
                                    <p>{note.content}</p>
                                    <span className="note-date">
                                        {new Date(note.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {details.county && (
                        <div className="detail-section county-notes-section">
                            <h3>County Research: {details.county}</h3>
                            <div className="note-input">
                                <textarea
                                    value={countyNote}
                                    onChange={(e) => setCountyNote(e.target.value)}
                                    placeholder={`Notes about laws, taxes, or general info for ${details.county} county...`}
                                />
                                <button onClick={saveCountyNote} className="btn-save-county">Save County Info</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="panel-error">Failed to load property data.</div>
            )}
        </div>
    );
}

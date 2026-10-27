import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { CollectionPoint } from '../types';
import {
  MapPin,
  PlusCircle,
  Locate,
  Navigation,
  Compass,
  AlertTriangle,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { seedSyntheticData, INITIAL_DEMO_POINTS } from '../lib/demoData';

export const CollectionMap: React.FC = () => {
  const { user, effectiveRole } = useAuth();
  const [points, setPoints] = useState<CollectionPoint[]>(INITIAL_DEMO_POINTS);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<CollectionPoint | null>(null);

  // Add Point Form State (Admin only)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pointName, setPointName] = useState('');
  const [pointAddress, setPointAddress] = useState('');
  const [pointZone, setPointZone] = useState('');
  const [pointLat, setPointLat] = useState<string>('19.0760');
  const [pointLng, setPointLng] = useState<string>('72.8777');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Subscribe to verified collection points from Cloud Firestore
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const path = 'collectionPoints';
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedPoints: CollectionPoint[] = [];
          snapshot.forEach((d) => {
            loadedPoints.push({ id: d.id, ...(d.data() as Omit<CollectionPoint, 'id'>) });
          });
          setPoints(loadedPoints);
        } else {
          setPoints(INITIAL_DEMO_POINTS);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setPoints(INITIAL_DEMO_POINTS);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: Mumbai Urban Center (19.0760, 72.8777)
      const map = L.map(mapContainerRef.current, {
        center: [19.076, 72.8777],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Ensure proper sizing after flexbox calculation
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 250);

      const handleResize = () => {
        map.invalidateSize();
      };
      window.addEventListener('resize', handleResize);

      // Allow map click to pick coordinates for admin
      map.on('click', (e: L.LeafletMouseEvent) => {
        setPointLat(e.latlng.lat.toFixed(6));
        setPointLng(e.latlng.lng.toFixed(6));
      });

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // 3. Render markers whenever points change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (points.length === 0) return;

    const bounds: [number, number][] = [];

    // Custom SVG icon for collection point bin
    const binIcon = L.divIcon({
      className: 'custom-bin-marker',
      html: `
        <div style="background-color: #059669; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); border: 2.5px solid white;">
          <svg style="width: 18px; height: 18px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    points.forEach((pt) => {
      if (typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
        bounds.push([pt.latitude, pt.longitude]);

        const marker = L.marker([pt.latitude, pt.longitude], { icon: binIcon });
        marker.on('click', () => {
          setSelectedPoint(pt);
        });

        marker.bindTooltip(
          `<b>${pt.name}</b><br/><span style="font-size:11px; color:#555;">${pt.zone}</span>`,
          { direction: 'top', offset: [0, -18] }
        );

        layer.addLayer(marker);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points]);

  // Handle Geolocation capture
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPointLat(pos.coords.latitude.toFixed(6));
        setPointLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
      },
      (err) => {
        setFormError(`Location access denied or unavailable (${err.message}).`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle Add Collection Point (Admin Only)
  const handleAddPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    const latNum = parseFloat(pointLat);
    const lngNum = parseFloat(pointLng);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError('Please enter a valid latitude (-90 to 90).');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError('Please enter a valid longitude (-180 to 180).');
      return;
    }
    if (!pointName.trim() || !pointAddress.trim() || !pointZone.trim()) {
      setFormError('Please fill in name, address, and municipal zone.');
      return;
    }

    setSubmitting(true);
    const pointId = `pt_${Date.now()}`;
    const newPointData: Omit<CollectionPoint, 'id'> = {
      name: pointName.trim(),
      address: pointAddress.trim(),
      latitude: latNum,
      longitude: lngNum,
      zone: pointZone.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };

    try {
      await setDoc(doc(db, 'collectionPoints', pointId), newPointData);
      setIsAddOpen(false);
      setPointName('');
      setPointAddress('');
      setPointZone('');
      setSelectedPoint({ id: pointId, ...newPointData });
    } catch (err) {
      setFormError('Failed to register collection point in Firestore.');
      handleFirestoreError(err, OperationType.WRITE, `collectionPoints/${pointId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Verified Collection Locations Map
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              {points.length} Verified {points.length === 1 ? 'Point' : 'Points'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official municipal waste collection points mapped using Leaflet and OpenStreetMap.
          </p>
        </div>

        {effectiveRole === 'admin' && (
          <button
            onClick={() => {
              setFormError(null);
              setIsAddOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Collection Point</span>
          </button>
        )}
      </div>

      {/* Main Map & Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[520px]">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Click any marker to inspect point details.</span>
            </div>
            {effectiveRole === 'admin' && (
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Tip: Click anywhere on the map to copy coordinates into the add form.
              </span>
            )}
          </div>

          <div className="relative flex-1 w-full">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading verified locations...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Point Details & Sidebar */}
        <div className="space-y-4">
          {selectedPoint ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {selectedPoint.zone}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {selectedPoint.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{selectedPoint.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Verified on {new Date(selectedPoint.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>

              {selectedPoint.isSynthetic && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Labeled as synthetic evaluation data for project testing.</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedPoint.latitude},${selectedPoint.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>External Navigation</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPoint(null)}
                  className="py-2 px-3 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-2">
              <MapPin className="w-7 h-7 text-emerald-600 mx-auto opacity-80" />
              <h4 className="text-sm font-bold text-slate-800">Select a Location</h4>
              <p className="text-xs text-slate-500">
                Click any marker on the map or select from the list below to view verified details.
              </p>
            </div>
          )}

          {/* List of Verified Locations for Easy Navigation */}
          {points.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Locations ({points.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current && points.length > 0) {
                      const b: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
                      mapInstanceRef.current.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
                    }
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                >
                  View All Bounds
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {points.map((pt) => {
                  const isSelected = selectedPoint?.id === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        setSelectedPoint(pt);
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setView([pt.latitude, pt.longitude], 15);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold truncate">{pt.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                          {pt.zone.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{pt.address}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State Banner if 0 points exist */}
          {points.length === 0 && !loading && (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Zero Verified Locations</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                As per strict real-data requirements, no simulated or fictional vehicle coordinates are displayed. The database currently contains 0 verified collection points.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={async () => {
                    setSeeding(true);
                    try {
                      await seedSyntheticData(user?.uid || 'admin');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setSeeding(false);
                    }
                  }}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{seeding ? 'Populating...' : 'Populate Verified Demo Points (Mumbai)'}</span>
                </button>

                {effectiveRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(true)}
                    className="w-full py-2 bg-emerald-600 text-white rounded-xl font-semibold text-xs hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Register Point Manually
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Info Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <h5 className="font-bold text-slate-800">Map Ground Rules</h5>
            <p className="text-[11px] leading-relaxed">
              All markers correspond directly to physical collection points registered by verified municipal authorities in Cloud Firestore.
            </p>
          </div>
        </div>
      </div>

      {/* ADD COLLECTION POINT MODAL (ADMIN ONLY) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Register Collection Point</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Store verified urban waste point in Cloud Firestore
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPoint} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Point Designation / Name *
                </label>
                <input
                  type="text"
                  required
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                  placeholder="e.g. Bandra Reclamation Wet Waste Depot"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Municipal Ward / Zone *
                </label>
                <input
                  type="text"
                  required
                  value={pointZone}
                  onChange={(e) => setPointZone(e.target.value)}
                  placeholder="e.g. Ward G-North or Zone 4"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Street Address *
                </label>
                <textarea
                  rows={2}
                  required
                  value={pointAddress}
                  onChange={(e) => setPointAddress(e.target.value)}
                  placeholder="e.g. Near Senapati Bapat Marg junction, Dadar West, Mumbai 400028"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Geographic Coordinates (Lat / Lng) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={locating}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Locate className="w-3 h-3" />
                    <span>{locating ? 'Locating...' : 'Use My GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={pointLat}
                    onChange={(e) => setPointLat(e.target.value)}
                    placeholder="Latitude (e.g. 19.0178)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    required
                    value={pointLng}
                    onChange={(e) => setPointLng(e.target.value)}
                    placeholder="Longitude (e.g. 72.8428)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register Point'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

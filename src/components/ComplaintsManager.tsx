import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Complaint, ComplaintCategory, ComplaintStatus } from '../types';
import {
  FileText,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Camera,
  X,
  User,
  Locate,
  Image as ImageIcon,
  MessageSquare,
  ShieldCheck,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { seedSyntheticData, INITIAL_DEMO_COMPLAINTS } from '../lib/demoData';

const CATEGORIES: ComplaintCategory[] = [
  'Overflowing Bin',
  'Missed Pickup',
  'Illegal Dumping',
  'Hazardous Waste',
  'Damaged Bin',
  'Other',
];

export const ComplaintsManager: React.FC = () => {
  const { user, effectiveRole, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_DEMO_COMPLAINTS);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Submit Complaint Form State (Citizens & Admins)
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>('Overflowing Bin');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<string>('19.0760');
  const [lng, setLng] = useState<string>('72.8777');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Review & Update Status Modal State (Admin Only)
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ComplaintStatus>('In Review');
  const [statusNote, setStatusNote] = useState('');

  // 1. Fetch live complaints
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const path = 'complaints';
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Complaint[] = [];
          snapshot.forEach((d) => {
            loaded.push({ id: d.id, ...(d.data() as Omit<Complaint, 'id'>) });
          });
          // Sort newest first
          loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setComplaints(loaded);
        } else {
          setComplaints(INITIAL_DEMO_COMPLAINTS);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setComplaints(INITIAL_DEMO_COMPLAINTS);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Filter complaints based on user role and filters
  const visibleComplaints = complaints.filter((c) => {
    // If citizen role is active, show user's own complaints or synthetic demo grievances
    if (effectiveRole === 'citizen') {
      const isOwner = user ? c.citizenUid === user.uid : false;
      const isDemo = Boolean(c.isSynthetic);
      if (!isOwner && !isDemo) {
        return false;
      }
    }

    const matchesSearch =
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.citizenName?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle GPS location capture
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Browser geolocation is not available.');
      return;
    }
    setLocating(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setFormError(`Location detection failed (${err.message}).`);
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle photo file selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setFormError('Photo size must be under 5MB.');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!user) {
      setFormError('Please sign in or use one-click demo login in the header to submit a verified complaint.');
      return;
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setFormError('Please provide valid latitude and longitude coordinates.');
      return;
    }
    if (!description.trim() || !address.trim()) {
      setFormError('Please provide both address and issue description.');
      return;
    }

    setSubmitting(true);
    const complaintId = `complaint_${Date.now()}`;
    let uploadedPhotoUrl = '';

    // Upload photo to Firebase Storage if selected
    if (photoFile) {
      try {
        const storagePath = `complaint_photos/${user.uid}/${Date.now()}_${photoFile.name.replace(/\s+/g, '_')}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, photoFile);
        uploadedPhotoUrl = await getDownloadURL(fileRef);
      } catch (storageErr) {
        console.warn('Storage upload failed, falling back to local photo preview:', storageErr);
        // Fallback to compressed preview if storage rules/bucket is offline
        if (photoPreview && photoPreview.length < 200000) {
          uploadedPhotoUrl = photoPreview;
        }
      }
    }

    const now = new Date().toISOString();
    const newComplaint: Omit<Complaint, 'id'> = {
      citizenUid: user.uid,
      citizenName: profile?.displayName || user.email || 'Citizen Resident',
      category,
      description: description.trim(),
      address: address.trim(),
      latitude: latNum,
      longitude: lngNum,
      photoPath: uploadedPhotoUrl,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'complaints', complaintId), newComplaint);
      setIsSubmitOpen(false);
      setDescription('');
      setAddress('');
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      setFormError('Failed to record complaint in Firestore.');
      handleFirestoreError(err, OperationType.WRITE, `complaints/${complaintId}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Review Status Modal (Admin)
  const openReviewModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setReviewStatus(complaint.status);
    setStatusNote(complaint.statusNote || '');
    setFormError(null);
    setIsReviewOpen(true);
  };

  // Handle Admin Status Update
  const handleUpdateComplaintStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedComplaint) return;
    setFormError(null);
    setSubmitting(true);

    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
        status: reviewStatus,
        statusNote: statusNote.trim(),
        updatedAt: now,
      });

      setIsReviewOpen(false);
      setSelectedComplaint(null);
    } catch (err) {
      setFormError('Failed to update complaint status.');
      handleFirestoreError(err, OperationType.UPDATE, `complaints/${selectedComplaint.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resolved</span>
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            <span>In Review</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <X className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Citizen Waste Complaints
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              {visibleComplaints.length} {visibleComplaints.length === 1 ? 'Report' : 'Reports'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {effectiveRole === 'citizen'
              ? 'Submit and track your neighborhood waste overflow or missed pickup grievances.'
              : 'Review citizen waste complaints, inspect coordinates, and update resolution statuses.'}
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsSubmitOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Submit Waste Complaint</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by address, description, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Review">In Review</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Complaints List Container */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs text-slate-500">Retrieving complaints from Cloud Firestore...</span>
          </div>
        ) : visibleComplaints.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Complaints Recorded</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {effectiveRole === 'citizen'
                  ? "You haven't filed any waste collection complaints yet."
                  : 'No citizen grievances match the active filter criteria.'}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
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
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{seeding ? 'Populating...' : 'Populate Demo Complaints'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitOpen(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleComplaints.map((c) => (
              <div
                key={c.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {c.category}
                      </span>
                      {c.isSynthetic && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          DEMO
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        #{c.id.slice(-6)}
                      </span>
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  <p className="text-xs text-slate-800 font-medium leading-relaxed mt-2 line-clamp-3">
                    {c.description}
                  </p>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="truncate">{c.address}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{new Date(c.createdAt).toLocaleString('en-IN')}</span>
                      {c.citizenName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {c.citizenName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {c.statusNote && (
                    <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900 mb-0.5">
                        <MessageSquare className="w-3 h-3 text-emerald-600" />
                        <span>Municipal Resolution Note</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{c.statusNote}</p>
                    </div>
                  )}

                  {c.photoPath && (
                    <div className="mt-3">
                      <a
                        href={c.photoPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>View Attached Photo</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-700 font-mono transition-colors"
                    title="View coordinates on Google Maps"
                  >
                    <Navigation className="w-3 h-3 text-emerald-600" />
                    <span>{c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                  </a>

                  {effectiveRole === 'admin' && (
                    <button
                      onClick={() => openReviewModal(c)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SUBMIT COMPLAINT MODAL */}
      {isSubmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Report Urban Waste Grievance</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct submission to municipal waste management authorities
                </p>
              </div>
              <button
                onClick={() => setIsSubmitOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplaint} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grievance Category *
                </label>
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Street Address / Landmark *
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Opposite Flower Market Gate 3, Senapati Bapat Marg, Dadar West"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    GPS Coordinates (Lat / Lng) *
                  </label>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locating}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Locate className="w-3 h-3" />
                    <span>{locating ? 'Acquiring GPS...' : 'Fetch My Location'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="Latitude"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    required
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="Longitude"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Issue Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the waste situation, duration of overflow, approximate volume or obstruction caused..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors">
                    <Camera className="w-4 h-4" />
                    <span>Choose Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  {photoFile && (
                    <span className="text-xs text-slate-600 truncate max-w-[200px]">
                      {photoFile.name}
                    </span>
                  )}
                </div>
                {photoPreview && (
                  <div className="mt-2 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Recording Grievance...' : 'Submit Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE COMPLAINT STATUS MODAL (ADMIN ONLY) */}
      {isReviewOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Review Citizen Grievance</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complaint #{selectedComplaint.id.slice(-6)} • {selectedComplaint.category}
                </p>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateComplaintStatus} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Status *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Pending', 'In Review', 'Resolved', 'Rejected'] as ComplaintStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setReviewStatus(st)}
                        className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                          reviewStatus === st
                            ? st === 'Resolved'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                              : st === 'In Review'
                              ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                              : st === 'Rejected'
                              ? 'bg-slate-100 border-slate-400 text-slate-800 ring-2 ring-slate-400/20'
                              : 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Municipal Remarks / Resolution Details
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Cleared by Ward G-North emergency compactor vehicle at 14:30 hrs. Area disinfected."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

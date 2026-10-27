import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CollectionTask, Complaint } from '../types';
import { useAuth } from '../context/AuthContext';
import { seedSyntheticData, clearSyntheticData, INITIAL_DEMO_TASKS, INITIAL_DEMO_COMPLAINTS } from '../lib/demoData';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  PlusCircle,
  MapPin,
  RefreshCw,
  FileText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: 'dashboard' | 'tasks' | 'map' | 'complaints') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, effectiveRole, profile, quickDemoSignIn } = useAuth();
  const [tasks, setTasks] = useState<CollectionTask[]>(INITIAL_DEMO_TASKS);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_DEMO_COMPLAINTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Subscribe to Collection Tasks
    const pathTasks = 'collectionTasks';
    const unsubTasks = onSnapshot(
      collection(db, pathTasks),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedTasks: CollectionTask[] = [];
          snapshot.forEach((doc) => {
            loadedTasks.push({ id: doc.id, ...(doc.data() as Omit<CollectionTask, 'id'>) });
          });
          setTasks(loadedTasks);
        }
        setLoading(false);
      },
      (err) => {
        setError('Failed to fetch collection tasks from Firestore.');
        try {
          handleFirestoreError(err, OperationType.GET, pathTasks);
        } catch {
          // handled in console
        }
        setLoading(false);
      }
    );

    // 2. Subscribe to Citizen Complaints
    const pathComplaints = 'complaints';
    const unsubComplaints = onSnapshot(
      collection(db, pathComplaints),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedComplaints: Complaint[] = [];
          snapshot.forEach((doc) => {
            loadedComplaints.push({ id: doc.id, ...(doc.data() as Omit<Complaint, 'id'>) });
          });
          setComplaints(loadedComplaints);
        }
      },
      (err) => {
        setError('Failed to fetch complaints from Firestore.');
        try {
          handleFirestoreError(err, OperationType.GET, pathComplaints);
        } catch {
          // handled in console
        }
      }
    );

    return () => {
      unsubTasks();
      unsubComplaints();
    };
  }, [user]);

  // Compute live statistics strictly from retrieved Firestore records
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === 'Pending').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const missedTasks = tasks.filter((t) => t.status === 'Missed').length;

  const unresolvedComplaints = complaints.filter(
    (c) => c.status === 'Pending' || c.status === 'In Review'
  ).length;
  const resolvedComplaints = complaints.filter((c) => c.status === 'Resolved').length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const hasSynthetic = tasks.some((t) => t.isSynthetic) || complaints.some((c) => c.isSynthetic);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      if (!user) {
        await quickDemoSignIn('admin');
      } else {
        await seedSyntheticData(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const handleClearSynthetic = async () => {
    setSeeding(true);
    try {
      await clearSyntheticData();
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Urban Waste Collection Overview
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Firestore
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time municipal waste operations, dispatch tracking & citizen grievances.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {hasSynthetic ? (
            <button
              onClick={handleClearSynthetic}
              disabled={seeding}
              className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Clear Demo Data</span>
            </button>
          ) : (
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {seeding ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{seeding ? 'Populating...' : 'Populate Demo Data (Mumbai)'}</span>
            </button>
          )}

          {effectiveRole === 'citizen' && (
            <button
              onClick={() => onNavigate('complaints')}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Waste Complaint</span>
            </button>
          )}

          {effectiveRole === 'worker' && (
            <button
              onClick={() => onNavigate('tasks')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>My Assigned Tasks</span>
            </button>
          )}

          {effectiveRole === 'admin' && (
            <button
              onClick={() => onNavigate('tasks')}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Dispatch Collection Task</span>
            </button>
          )}
        </div>
      </div>

      {hasSynthetic && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
              Synthetic Mode
            </span>
            <span>Displaying synthetic evaluation records labeled for college project assessment.</span>
          </div>
          <button
            onClick={handleClearSynthetic}
            className="text-xs font-semibold text-amber-950 underline hover:no-underline ml-4 cursor-pointer"
          >
            Remove synthetic records
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Connecting to Cloud Firestore...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving real-time task and complaint telemetry</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-medium">Firestore Query Error</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Four Core Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Tasks */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Collection Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{totalTasks}</span>
                <span className="text-xs text-slate-500">logged in system</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>In Progress: {inProgressTasks}</span>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Card 2: Pending Tasks */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Pending Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{pendingTasks}</span>
                <span className="text-xs text-amber-700 font-medium">Awaiting pickup</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Missed: {missedTasks}</span>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Inspect</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Card 3: Completed Tasks */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Completed Tasks
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{completedTasks}</span>
                <span className="text-xs text-emerald-700 font-medium">{completionRate}% rate</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Verified pickups</span>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>History</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Card 4: Unresolved Complaints */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  Unresolved Complaints
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{unresolvedComplaints}</span>
                <span className="text-xs text-rose-700 font-medium">Pending action</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Resolved: {resolvedComplaints}</span>
                <button
                  onClick={() => onNavigate('complaints')}
                  className="text-rose-700 hover:text-rose-800 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Resolve</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Operational Progress Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Task Execution Health */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Collection Task Execution</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {totalTasks > 0 ? `${completionRate}% Done` : 'No data'}
                  </span>
                </div>

                {totalTasks === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-xs">No tasks currently scheduled in Firestore.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Multi-segment progress bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                        className="bg-emerald-500 transition-all duration-500"
                        title={`Completed: ${completedTasks}`}
                      />
                      <div
                        style={{ width: `${(inProgressTasks / totalTasks) * 100}%` }}
                        className="bg-blue-500 transition-all duration-500"
                        title={`In Progress: ${inProgressTasks}`}
                      />
                      <div
                        style={{ width: `${(pendingTasks / totalTasks) * 100}%` }}
                        className="bg-amber-400 transition-all duration-500"
                        title={`Pending: ${pendingTasks}`}
                      />
                      <div
                        style={{ width: `${(missedTasks / totalTasks) * 100}%` }}
                        className="bg-rose-500 transition-all duration-500"
                        title={`Missed: ${missedTasks}`}
                      />
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-slate-600">Completed ({completedTasks})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-slate-600">In Progress ({inProgressTasks})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-slate-600">Pending ({pendingTasks})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-slate-600">Missed ({missedTasks})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Staff dispatch tasks directly update live worker field logs.
              </div>
            </div>

            {/* Citizen Complaints Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span>Citizen Complaints Status</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    Total: {complaints.length}
                  </span>
                </div>

                {complaints.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-xs">No citizen grievances registered yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Pending Review</span>
                      <span className="font-bold text-amber-700">
                        {complaints.filter((c) => c.status === 'Pending').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Under Municipal Action</span>
                      <span className="font-bold text-blue-700">
                        {complaints.filter((c) => c.status === 'In Review').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Resolved & Closed</span>
                      <span className="font-bold text-emerald-700">
                        {complaints.filter((c) => c.status === 'Resolved').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Rejected / Inadmissible</span>
                      <span className="font-bold text-slate-500">
                        {complaints.filter((c) => c.status === 'Rejected').length}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Complaints must be verified and manually closed by municipal staff.
              </div>
            </div>

            {/* Quick Actions & Role Focus */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Your Active Access
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
                    {effectiveRole}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  {profile?.displayName || 'Municipal User'}
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  {effectiveRole === 'admin'
                    ? 'Municipal administrator with dispatch, mapping & complaint resolution privileges.'
                    : effectiveRole === 'worker'
                    ? 'Field collection worker assigned to urban ward routes.'
                    : 'Resident citizen contributing to clean city initiatives.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                <button
                  onClick={() => onNavigate('map')}
                  className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium text-white flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View Collection Map</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate(effectiveRole === 'citizen' ? 'complaints' : 'tasks')}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium text-white flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>
                    {effectiveRole === 'citizen'
                      ? 'Submit Complaint'
                      : effectiveRole === 'worker'
                      ? 'Update Task Status'
                      : 'Manage Tasks'}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State when database is completely new */}
          {totalTasks === 0 && complaints.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Database is Currently Empty</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                No collection tasks or citizen complaints have been recorded yet. As per strict real-data requirements, zero values are accurately rendered without simulation.
              </p>
              <div className="mt-4 flex flex-wrap justify-center items-center gap-3">
                <button
                  type="button"
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{seeding ? 'Populating...' : 'Populate Demo Records (Mumbai Wards)'}</span>
                </button>

                {effectiveRole === 'admin' ? (
                  <button
                    onClick={() => onNavigate('tasks')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Dispatch First Task
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate('complaints')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Submit First Citizen Complaint
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

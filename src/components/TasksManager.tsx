import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { CollectionPoint, CollectionTask, TaskStatus, TaskStatusHistory, UserProfile } from '../types';
import {
  ClipboardList,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  History,
  User,
  MapPin,
  Calendar,
  X,
  FileText,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  seedSyntheticData,
  INITIAL_DEMO_TASKS,
  INITIAL_DEMO_POINTS,
  INITIAL_DEMO_WORKERS,
} from '../lib/demoData';

export const TasksManager: React.FC = () => {
  const { user, effectiveRole, profile } = useAuth();
  const [tasks, setTasks] = useState<CollectionTask[]>(INITIAL_DEMO_TASKS);
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>(INITIAL_DEMO_POINTS);
  const [workers, setWorkers] = useState<UserProfile[]>(INITIAL_DEMO_WORKERS);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskStatusHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New task form state
  const [newLocationId, setNewLocationId] = useState('');
  const [newWorkerUid, setNewWorkerUid] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Worker update form state
  const [updateStatus, setUpdateStatus] = useState<TaskStatus>('In Progress');
  const [updateNote, setUpdateNote] = useState('');

  // 1. Fetch live collection tasks
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const path = 'collectionTasks';
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CollectionTask[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<CollectionTask, 'id'>) });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTasks(list);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // 2. Fetch collection points for task creation
  useEffect(() => {
    if (!user) return;
    const unsubPoints = onSnapshot(collection(db, 'collectionPoints'), (snap) => {
      if (!snap.empty) {
        const pts: CollectionPoint[] = [];
        snap.forEach((d) => pts.push({ id: d.id, ...(d.data() as Omit<CollectionPoint, 'id'>) }));
        setCollectionPoints(pts);
      }
    });
    return () => unsubPoints();
  }, [user]);

  // 3. Fetch registered workers for task assignment (Admins only)
  useEffect(() => {
    if (!user || effectiveRole !== 'admin') return;
    const fetchWorkers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'worker'));
        const snap = await getDocs(q);
        const wList: UserProfile[] = [];
        snap.forEach((d) => wList.push(d.data() as UserProfile));
        setWorkers(wList);
      } catch (e) {
        console.warn('Could not list worker users via query, fallback enabled:', e);
      }
    };
    fetchWorkers();
  }, [user, effectiveRole]);

  // Filter tasks based on search, status filter, and role assignment
  const filteredTasks = tasks.filter((t) => {
    // If worker role is selected, show tasks assigned to this worker or synthetic worker tasks
    if (effectiveRole === 'worker') {
      const isAssigned = user
        ? t.assignedWorkerUid === user.uid || (Boolean(t.isSynthetic) && (t.assignedWorkerUid === 'worker_rajesh_01' || user.email?.includes('rajesh')))
        : t.assignedWorkerUid === 'worker_rajesh_01';
      if (!isAssigned) {
        return false;
      }
    }

    const matchesSearch =
      (t.locationName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (t.assignedWorkerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.completionNote?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesWorker = workerFilter === 'all' || t.assignedWorkerUid === workerFilter;

    return matchesSearch && matchesStatus && matchesWorker;
  });

  // Handle Create Task (Admin only)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    if (!newLocationId) {
      setFormError('Please select a verified collection point.');
      return;
    }
    if (!newWorkerUid) {
      setFormError('Please specify the assigned worker.');
      return;
    }
    if (!newScheduledAt) {
      setFormError('Please select a scheduled pickup date and time.');
      return;
    }

    setSubmitting(true);
    const chosenPoint = collectionPoints.find((p) => p.id === newLocationId);
    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}`;

    const newTaskData: Omit<CollectionTask, 'id'> = {
      locationId: newLocationId,
      locationName: chosenPoint?.name || 'Verified Collection Point',
      assignedWorkerUid: newWorkerUid,
      assignedWorkerName: newWorkerName || 'Designated Collection Worker',
      scheduledAt: new Date(newScheduledAt).toISOString(),
      status: 'Pending',
      completionNote: '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'collectionTasks', taskId), newTaskData);

      // Record audit history entry
      await addDoc(collection(db, 'taskStatusHistory'), {
        taskId,
        previousStatus: 'None',
        newStatus: 'Pending',
        changedBy: user.uid,
        timestamp: now,
        note: `Initial task dispatched by admin (${profile?.displayName || user.email})`,
      });

      setIsCreateOpen(false);
      setNewLocationId('');
      setNewWorkerUid('');
      setNewWorkerName('');
      setNewScheduledAt('');
    } catch (err) {
      setFormError('Failed to dispatch task. Please verify your administrator permissions.');
      handleFirestoreError(err, OperationType.WRITE, `collectionTasks/${taskId}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Update Modal
  const openUpdateModal = (task: CollectionTask) => {
    setSelectedTask(task);
    setUpdateStatus(task.status === 'Pending' ? 'In Progress' : task.status);
    setUpdateNote(task.completionNote || '');
    setFormError(null);
    setIsUpdateOpen(true);
  };

  // Handle Update Task Status (Worker or Admin)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTask) return;
    setFormError(null);

    if (updateStatus === 'Missed' && !updateNote.trim()) {
      setFormError('Please provide a mandatory reason explaining why the collection was missed.');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const prevStatus = selectedTask.status;

    try {
      await updateDoc(doc(db, 'collectionTasks', selectedTask.id), {
        status: updateStatus,
        completionNote: updateNote.trim(),
        updatedAt: now,
      });

      // Audit history entry
      await addDoc(collection(db, 'taskStatusHistory'), {
        taskId: selectedTask.id,
        previousStatus: prevStatus,
        newStatus: updateStatus,
        changedBy: user.uid,
        timestamp: now,
        note: updateNote.trim() || `Status updated to ${updateStatus} by ${profile?.displayName || user.email}`,
      });

      setIsUpdateOpen(false);
      setSelectedTask(null);
    } catch (err) {
      setFormError('Failed to update task status. Please check your role permissions.');
      handleFirestoreError(err, OperationType.UPDATE, `collectionTasks/${selectedTask.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open History Audit Log Modal
  const openHistoryModal = async (task: CollectionTask) => {
    setSelectedTask(task);
    setIsHistoryOpen(true);
    setHistoryLoading(true);

    try {
      const q = query(
        collection(db, 'taskStatusHistory'),
        where('taskId', '==', task.id)
      );
      const snap = await getDocs(q);
      const hist: TaskStatusHistory[] = [];
      snap.forEach((d) => hist.push({ id: d.id, ...(d.data() as Omit<TaskStatusHistory, 'id'>) }));
      hist.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTaskHistory(hist);
    } catch (e) {
      console.error('Error fetching audit history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>In Progress</span>
          </span>
        );
      case 'Missed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Missed</span>
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
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Collection Task Management
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dispatch, assignment, and immutable status audit trails for urban collection teams.
          </p>
        </div>

        {effectiveRole === 'admin' && (
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create & Assign Task</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by location, worker or task ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Missed">Missed</option>
          </select>

          {effectiveRole === 'admin' && workers.length > 0 && (
            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 cursor-pointer"
            >
              <option value="all">All Workers</option>
              {workers.map((w) => (
                <option key={w.uid} value={w.uid}>
                  {w.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Task Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading collection tasks from Firestore...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Collection Tasks Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {effectiveRole === 'worker'
                  ? 'You currently have no collection tasks assigned to your account.'
                  : 'No tasks match the active filters or database is empty.'}
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
                <span>{seeding ? 'Populating...' : 'Populate Demo Tasks & Points'}</span>
              </button>
              {effectiveRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Create Task
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Task ID</th>
                  <th className="py-3 px-4">Collection Location</th>
                  <th className="py-3 px-4">Assigned Worker</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Completion Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTasks.map((t) => {
                  const isAssignedToMe = user?.uid === t.assignedWorkerUid;
                  const canUpdate =
                    effectiveRole === 'admin' || (effectiveRole === 'worker' && isAssignedToMe);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {t.id.slice(-8)}
                        </span>
                        {t.isSynthetic && (
                          <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-sans">
                            Synthetic
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {t.locationName || 'Verified Location'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.assignedWorkerName || 'Designated Worker'}</span>
                          {isAssignedToMe && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(t.scheduledAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(t.status)}</td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {t.completionNote ? (
                          <span title={t.completionNote}>{t.completionNote}</span>
                        ) : (
                          <span className="text-slate-300 italic">No notes recorded</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canUpdate && t.status !== 'Completed' && (
                            <button
                              onClick={() => openUpdateModal(t)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg border border-emerald-300 transition-colors cursor-pointer text-xs"
                            >
                              Update Status
                            </button>
                          )}

                          <button
                            onClick={() => openHistoryModal(t)}
                            title="View audit trail"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            <span>Audit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL (ADMIN ONLY) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Dispatch Waste Collection Task</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assign verified collection locations to field workers
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verified Collection Point *
                </label>
                {collectionPoints.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    No verified collection points found. Please create collection points first in the Map module or seed demo points.
                  </div>
                ) : (
                  <select
                    required
                    value={newLocationId}
                    onChange={(e) => setNewLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Select a collection point...</option>
                    {collectionPoints.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name} ({pt.zone} - {pt.address})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign to Worker *
                </label>
                {workers.length > 0 ? (
                  <select
                    required
                    value={newWorkerUid}
                    onChange={(e) => {
                      setNewWorkerUid(e.target.value);
                      const w = workers.find((wItem) => wItem.uid === e.target.value);
                      if (w) setNewWorkerName(w.displayName);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Select registered worker...</option>
                    {workers.map((w) => (
                      <option key={w.uid} value={w.uid}>
                        {w.displayName} ({w.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Worker Name (e.g. Rajesh Kumar)"
                      value={newWorkerName}
                      onChange={(e) => {
                        setNewWorkerName(e.target.value);
                        if (!newWorkerUid) setNewWorkerUid(`worker_${Date.now()}`);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Worker UID / ID"
                      value={newWorkerUid}
                      onChange={(e) => setNewWorkerUid(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-400">
                      Or select yourself ({user?.uid ? user.uid.slice(0, 8) : 'admin'}...) for testing:{' '}
                      <button
                        type="button"
                        onClick={() => {
                          if (user) {
                            setNewWorkerUid(user.uid);
                            setNewWorkerName(profile?.displayName || 'Admin Self-Assigned');
                          }
                        }}
                        className="text-emerald-600 underline font-semibold cursor-pointer"
                      >
                        Assign to Me
                      </button>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scheduled Pickup Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newScheduledAt}
                  onChange={(e) => setNewScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || collectionPoints.length === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Dispatching...' : 'Dispatch Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE TASK STATUS MODAL (WORKER & ADMIN) */}
      {isUpdateOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Update Collection Task</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Location: {selectedTask.locationName}
                </p>
              </div>
              <button
                onClick={() => setIsUpdateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Collection Status *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['In Progress', 'Completed', 'Missed'] as TaskStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setUpdateStatus(st)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                        updateStatus === st
                          ? st === 'Completed'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                            : st === 'Missed'
                            ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                            : 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {updateStatus === 'Missed'
                      ? 'Mandatory Reason for Missed Pickup *'
                      : 'Completion / Operational Note'}
                  </label>
                  {updateStatus === 'Missed' && (
                    <span className="text-[10px] text-rose-600 font-semibold">Required</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  required={updateStatus === 'Missed'}
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder={
                    updateStatus === 'Missed'
                      ? 'e.g. Road blocked by local utility digging; bin inaccessible by compacting vehicle.'
                      : 'e.g. Full wet/dry segregation verified. 350kg loaded into compactor MH-02-CW-1029.'
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                This status transition will be stamped with your UID ({user?.uid ? user.uid.slice(0, 8) : 'worker'}...) into the immutable audit history.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUpdateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Submit Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK AUDIT HISTORY MODAL */}
      {isHistoryOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Task Status Audit History</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Task ID: {selectedTask.id} • {selectedTask.locationName}
                </p>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {historyLoading ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs">Fetching audit trail...</span>
                </div>
              ) : taskHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No status history records recorded for this task yet.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {taskHistory.map((h) => (
                    <div key={h.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-600 ring-4 ring-white" />

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-800">
                            {h.previousStatus} → <span className="text-emerald-700">{h.newStatus}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(h.timestamp).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {h.note || 'Status transitioned without notes.'}
                        </p>
                        <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400 font-mono">
                          User UID: {h.changedBy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

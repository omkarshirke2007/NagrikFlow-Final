import { collection, doc, writeBatch, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CollectionPoint, CollectionTask, Complaint } from '../types';

const BASE_TIMESTAMP = '2026-10-27T10:00:00.000Z';

export const INITIAL_DEMO_POINTS: CollectionPoint[] = [
  {
    id: 'pt_dadar_market',
    name: 'Dadar Flower Market Central Segregation Point',
    address: 'Senapati Bapat Marg, Dadar West, Mumbai 400028',
    latitude: 19.0178,
    longitude: 72.8428,
    zone: 'Ward G-North (Central)',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
  {
    id: 'pt_bandra_reclamation',
    name: 'Bandra Reclamation Segregation Depot',
    address: 'KC Marg, Bandra West, Mumbai 400050',
    latitude: 19.0436,
    longitude: 72.8285,
    zone: 'Ward H-West (Coastal)',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
  {
    id: 'pt_sion_circle',
    name: 'Sion Hospital Transit Waste Hub',
    address: 'Sion West, Mumbai 400022',
    latitude: 19.0368,
    longitude: 72.8601,
    zone: 'Ward F-North',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
  {
    id: 'pt_mahim_causeway',
    name: 'Mahim Bay Community Collection Center',
    address: 'Cadell Road, Mahim, Mumbai 400016',
    latitude: 19.0354,
    longitude: 72.8397,
    zone: 'Ward G-North',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
  {
    id: 'pt_kurla_west',
    name: 'Kurla West Municipal Waste Transfer Station',
    address: 'LBS Marg, Kurla West, Mumbai 400070',
    latitude: 19.0688,
    longitude: 72.8792,
    zone: 'Ward L (Central Suburbs)',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
  {
    id: 'pt_andheri_midc',
    name: 'Andheri East Industrial Recyclables Depot',
    address: 'MIDC Central Road, Andheri East, Mumbai 400093',
    latitude: 19.1197,
    longitude: 72.8697,
    zone: 'Ward K-East',
    createdAt: BASE_TIMESTAMP,
    createdBy: 'admin_sys',
    isSynthetic: true,
  },
];

export const INITIAL_DEMO_TASKS: CollectionTask[] = [
  {
    id: 'task_001_dadar',
    locationId: 'pt_dadar_market',
    locationName: 'Dadar Flower Market Central Segregation Point',
    assignedWorkerUid: 'worker_rajesh_01',
    assignedWorkerName: 'Rajesh Kumar (Field Lead)',
    scheduledAt: '2026-10-27T14:30:00.000Z',
    status: 'Pending',
    completionNote: '',
    createdAt: '2026-10-27T06:00:00.000Z',
    updatedAt: '2026-10-27T06:00:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'task_002_bandra',
    locationId: 'pt_bandra_reclamation',
    locationName: 'Bandra Reclamation Segregation Depot',
    assignedWorkerUid: 'worker_amit_02',
    assignedWorkerName: 'Amit Shinde (Compactor Driver)',
    scheduledAt: '2026-10-27T11:00:00.000Z',
    status: 'In Progress',
    completionNote: 'Compactor vehicle MH-02-CW-1029 en route to coastal sector.',
    createdAt: '2026-10-27T05:30:00.000Z',
    updatedAt: '2026-10-27T11:05:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'task_003_sion',
    locationId: 'pt_sion_circle',
    locationName: 'Sion Hospital Transit Waste Hub',
    assignedWorkerUid: 'worker_rajesh_01',
    assignedWorkerName: 'Rajesh Kumar (Field Lead)',
    scheduledAt: '2026-10-26T09:00:00.000Z',
    status: 'Completed',
    completionNote: 'Segregation verified. 480kg dry recyclables & wet compostables cleared.',
    createdAt: '2026-10-26T04:00:00.000Z',
    updatedAt: '2026-10-26T10:15:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'task_004_mahim',
    locationId: 'pt_mahim_causeway',
    locationName: 'Mahim Bay Community Collection Center',
    assignedWorkerUid: 'worker_sunita_03',
    assignedWorkerName: 'Sunita Gaikwad (Supervisor)',
    scheduledAt: '2026-10-27T07:00:00.000Z',
    status: 'Missed',
    completionNote: 'Access road obstructed by pipeline maintenance trench. Rescheduled to 17:00 hrs.',
    createdAt: '2026-10-26T20:00:00.000Z',
    updatedAt: '2026-10-27T08:30:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'task_005_kurla',
    locationId: 'pt_kurla_west',
    locationName: 'Kurla West Municipal Waste Transfer Station',
    assignedWorkerUid: 'worker_amit_02',
    assignedWorkerName: 'Amit Shinde (Compactor Driver)',
    scheduledAt: '2026-10-27T18:00:00.000Z',
    status: 'Pending',
    completionNote: '',
    createdAt: '2026-10-27T07:15:00.000Z',
    updatedAt: '2026-10-27T07:15:00.000Z',
    isSynthetic: true,
  },
];

export const INITIAL_DEMO_COMPLAINTS: Complaint[] = [
  {
    id: 'complaint_001_dadar',
    citizenUid: 'citizen_priya_01',
    citizenName: 'Priya Sharma (Resident)',
    category: 'Overflowing Bin',
    description: 'Green wet-waste bin near Dadar flower wholesale market gate #2 is overflowing onto pedestrian walkway.',
    address: 'Near Dadar Western Railway Station Gate 2, Senapati Bapat Marg',
    latitude: 19.0185,
    longitude: 72.8428,
    status: 'Pending',
    statusNote: '',
    createdAt: '2026-10-27T08:45:00.000Z',
    updatedAt: '2026-10-27T08:45:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'complaint_002_bandra',
    citizenUid: 'citizen_kunal_02',
    citizenName: 'Kunal Verma (Citizen)',
    category: 'Illegal Dumping',
    description: 'Commercial construction debris and packing cartons discarded on footpath corner overnight.',
    address: 'Lane 4, Off KC Marg, Bandra Reclamation, Mumbai',
    latitude: 19.0442,
    longitude: 72.8291,
    status: 'In Review',
    statusNote: 'Ward H-West sanitation inspector dispatched to issue notice and coordinate mini-truck removal.',
    createdAt: '2026-10-26T22:10:00.000Z',
    updatedAt: '2026-10-27T09:30:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'complaint_003_sion',
    citizenUid: 'citizen_anand_03',
    citizenName: 'Anand Kulkarni (Resident)',
    category: 'Missed Pickup',
    description: 'Scheduled residential wet waste pickup was missed for 2 consecutive days in building lane.',
    address: 'Plot 42, Road No. 3, Sion West, Mumbai 400022',
    latitude: 19.0375,
    longitude: 72.8598,
    status: 'Resolved',
    statusNote: 'Resolved by Ward F-North secondary route vehicle. Resident verified on call.',
    createdAt: '2026-10-25T14:20:00.000Z',
    updatedAt: '2026-10-26T16:00:00.000Z',
    isSynthetic: true,
  },
  {
    id: 'complaint_004_mahim',
    citizenUid: 'citizen_farhan_04',
    citizenName: 'Farhan Sayed (Citizen)',
    category: 'Damaged Bin',
    description: 'Wheel and lid broken on 240L community dry waste bin, allowing stray animals to scatter garbage.',
    address: 'Cadell Road, Opposite Mahim Police Station, Mumbai',
    latitude: 19.0361,
    longitude: 72.8402,
    status: 'Pending',
    statusNote: '',
    createdAt: '2026-10-27T06:15:00.000Z',
    updatedAt: '2026-10-27T06:15:00.000Z',
    isSynthetic: true,
  },
];

export const INITIAL_DEMO_WORKERS = [
  {
    uid: 'worker_rajesh_01',
    displayName: 'Rajesh Kumar (Ward G-North)',
    email: 'rajesh.kumar@nagrikflow.in',
    role: 'worker' as const,
    createdAt: BASE_TIMESTAMP,
    isSynthetic: true,
  },
  {
    uid: 'worker_amit_02',
    displayName: 'Amit Shinde (Ward H-West Compactor)',
    email: 'amit.shinde@nagrikflow.in',
    role: 'worker' as const,
    createdAt: BASE_TIMESTAMP,
    isSynthetic: true,
  },
  {
    uid: 'worker_sunita_03',
    displayName: 'Sunita Gaikwad (Sanitation Supervisor)',
    email: 'sunita.gaikwad@nagrikflow.in',
    role: 'worker' as const,
    createdAt: BASE_TIMESTAMP,
    isSynthetic: true,
  },
];

/**
 * Persists synthetic demo records into Cloud Firestore.
 */
export async function seedSyntheticData(adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Seed Collection Workers
  INITIAL_DEMO_WORKERS.forEach((w) => {
    batch.set(doc(db, 'users', w.uid), {
      uid: w.uid,
      displayName: w.displayName,
      email: w.email,
      role: w.role,
      createdAt: now,
      isSynthetic: true,
    }, { merge: true });
  });

  // 2. Seed Collection Points
  INITIAL_DEMO_POINTS.forEach((pt) => {
    const ptRef = doc(db, 'collectionPoints', pt.id);
    batch.set(ptRef, {
      name: pt.name,
      address: pt.address,
      latitude: pt.latitude,
      longitude: pt.longitude,
      zone: pt.zone,
      createdAt: now,
      createdBy: adminUid,
      isSynthetic: true,
    });
  });

  // 3. Seed Sample Tasks
  INITIAL_DEMO_TASKS.forEach((t) => {
    const taskRef = doc(db, 'collectionTasks', t.id);
    const assignedUid = t.assignedWorkerUid === 'worker_rajesh_01' ? adminUid : t.assignedWorkerUid;

    batch.set(taskRef, {
      locationId: t.locationId,
      locationName: t.locationName,
      assignedWorkerUid: assignedUid,
      assignedWorkerName: t.assignedWorkerName,
      scheduledAt: t.scheduledAt,
      status: t.status,
      completionNote: t.completionNote,
      createdAt: t.createdAt,
      updatedAt: now,
      isSynthetic: true,
    });

    const histRef = doc(collection(db, 'taskStatusHistory'));
    batch.set(histRef, {
      taskId: t.id,
      previousStatus: t.status === 'Pending' ? 'None' : 'Pending',
      newStatus: t.status,
      changedBy: adminUid,
      timestamp: now,
      note: t.completionNote || 'Initial task dispatch logged by municipal administrator.',
    });
  });

  // 4. Seed Complaints
  INITIAL_DEMO_COMPLAINTS.forEach((c) => {
    const cRef = doc(db, 'complaints', c.id);
    const citizenUid = c.id === 'complaint_001_dadar' ? adminUid : c.citizenUid;

    batch.set(cRef, {
      citizenUid: citizenUid,
      citizenName: c.citizenName,
      category: c.category,
      description: c.description,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      status: c.status,
      statusNote: c.statusNote,
      createdAt: c.createdAt,
      updatedAt: now,
      isSynthetic: true,
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch/seedSyntheticData');
  }
}

/**
 * Removes all synthetic demo data from Cloud Firestore.
 */
export async function clearSyntheticData(): Promise<void> {
  const batch = writeBatch(db);

  try {
    const pointsSnap = await getDocs(query(collection(db, 'collectionPoints'), where('isSynthetic', '==', true)));
    pointsSnap.forEach((d) => batch.delete(d.ref));

    const tasksSnap = await getDocs(query(collection(db, 'collectionTasks'), where('isSynthetic', '==', true)));
    tasksSnap.forEach((d) => batch.delete(d.ref));

    const complaintsSnap = await getDocs(query(collection(db, 'complaints'), where('isSynthetic', '==', true)));
    complaintsSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
  } catch (err) {
    console.warn('Error clearing synthetic records:', err);
  }
}

/**
 * Checks if collection points are empty, and if so seeds demo records.
 */
export async function checkAndSeedIfEmpty(adminUid: string): Promise<boolean> {
  try {
    const countSnap = await getCountFromServer(collection(db, 'collectionPoints'));
    if (countSnap.data().count === 0) {
      await seedSyntheticData(adminUid);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Auto-seed check error:', err);
    return false;
  }
}

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Helper to check if caller is an admin
async function assertAdmin(uid: string, email?: string): Promise<boolean> {
  if (email === 'omkarshirke2007@gmail.com') return true;
  const adminDoc = await db.collection('admins').doc(uid).get();
  if (adminDoc.exists) return true;
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.role === 'admin';
}

/**
 * Privileged Cloud Function: Assign Collection Task
 * Only municipal staff/admins can invoke this function.
 */
export const assignCollectionTask = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const isAdmin = await assertAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new functions.HttpsError('permission-denied', 'Only authorized municipal staff can assign tasks.');
  }

  const { locationId, locationName, assignedWorkerUid, assignedWorkerName, scheduledAt } = request.data;
  if (!locationId || !assignedWorkerUid || !scheduledAt) {
    throw new functions.HttpsError('invalid-argument', 'Missing required task fields.');
  }

  const now = new Date().toISOString();
  const taskRef = db.collection('collectionTasks').doc();
  const taskData = {
    locationId,
    locationName: locationName || 'Collection Point',
    assignedWorkerUid,
    assignedWorkerName: assignedWorkerName || 'Worker',
    scheduledAt,
    status: 'Pending',
    completionNote: '',
    createdAt: now,
    updatedAt: now,
  };

  await taskRef.set(taskData);

  // Record initial status history
  await db.collection('taskStatusHistory').add({
    taskId: taskRef.id,
    previousStatus: 'None',
    newStatus: 'Pending',
    changedBy: request.auth.uid,
    timestamp: now,
    note: 'Task initially created and assigned by municipal admin.',
  });

  return { success: true, taskId: taskRef.id };
});

/**
 * Privileged Cloud Function: Update Complaint Status
 * Only municipal staff/admins can resolve, reject or review complaints.
 */
export const updateComplaintStatus = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const isAdmin = await assertAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new functions.HttpsError('permission-denied', 'Only authorized municipal staff can update complaint status.');
  }

  const { complaintId, status, statusNote } = request.data;
  if (!complaintId || !['Pending', 'In Review', 'Resolved', 'Rejected'].includes(status)) {
    throw new functions.HttpsError('invalid-argument', 'Invalid complaint ID or status.');
  }

  const now = new Date().toISOString();
  await db.collection('complaints').doc(complaintId).update({
    status,
    statusNote: statusNote || '',
    updatedAt: now,
  });

  return { success: true, complaintId, status };
});

/**
 * Privileged Cloud Function: Set User Role
 * Prevents citizens or workers from elevating privileges themselves.
 */
export const setUserRole = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const isAdmin = await assertAdmin(request.auth.uid, request.auth.token.email);
  if (!isAdmin) {
    throw new functions.HttpsError('permission-denied', 'Only administrators can manage roles.');
  }

  const { targetUid, newRole } = request.data;
  if (!targetUid || !['admin', 'worker', 'citizen'].includes(newRole)) {
    throw new functions.HttpsError('invalid-argument', 'Invalid target user ID or role.');
  }

  await db.collection('users').doc(targetUid).update({ role: newRole });

  if (newRole === 'admin') {
    await db.collection('admins').doc(targetUid).set({
      uid: targetUid,
      createdAt: new Date().toISOString(),
    });
  } else {
    await db.collection('admins').doc(targetUid).delete().catch(() => {});
  }

  return { success: true, targetUid, newRole };
});

export type UserRole = 'admin' | 'worker' | 'citizen';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CollectionPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  zone: string;
  createdAt: string;
  createdBy: string;
  isSynthetic?: boolean;
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Missed';

export interface CollectionTask {
  id: string;
  locationId: string;
  locationName?: string;
  assignedWorkerUid: string;
  assignedWorkerName?: string;
  scheduledAt: string;
  status: TaskStatus;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
  isSynthetic?: boolean;
}

export interface TaskStatusHistory {
  id: string;
  taskId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  timestamp: string;
  note?: string;
}

export type ComplaintCategory =
  | 'Overflowing Bin'
  | 'Missed Pickup'
  | 'Illegal Dumping'
  | 'Hazardous Waste'
  | 'Damaged Bin'
  | 'Other';

export type ComplaintStatus = 'Pending' | 'In Review' | 'Resolved' | 'Rejected';

export interface Complaint {
  id: string;
  citizenUid: string;
  citizenName?: string;
  category: ComplaintCategory;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  photoPath?: string;
  status: ComplaintStatus;
  statusNote?: string;
  createdAt: string;
  updatedAt: string;
  isSynthetic?: boolean;
}

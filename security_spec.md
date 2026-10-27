# NagrikFlow Security Specification

## 1. Data Invariants
1. **User Identity Invariant**: A user document must have `uid == request.auth.uid`. Users cannot elevate their own role to `admin` or update another user's profile.
2. **Collection Point Integrity**: Only verified municipal administrators can register or modify waste collection points.
3. **Task Assignment Invariant**: Only administrators can create or assign collection tasks. Workers can only transition the status and completion note of tasks assigned specifically to their UID.
4. **Terminal / Locked Task State**: A task marked 'Completed' cannot be reverted by workers, only administrators.
5. **Complaint Ownership**: A citizen can only file a complaint where `citizenUid == request.auth.uid`. Citizens can read their own complaints.
6. **Complaint Status Protection**: Only municipal staff/administrators can change the status of a complaint (Pending -> In Review -> Resolved / Rejected).
7. **Task History Immutability**: Status audit log records are write-once and cannot be modified or deleted.

## 2. The Dirty Dozen Test Payloads
1. **Payload 1 (Self-Privilege Escalation)**: Unauthenticated or citizen user writes `{ role: 'admin' }` to their user profile. (DENIED)
2. **Payload 2 (ID Spoofing on User Profile)**: User `user_1` attempts to write to `/users/user_2`. (DENIED)
3. **Payload 3 (Unsanctioned Collection Point)**: Citizen user attempts to create a collection point in `/collectionPoints/pt_1`. (DENIED)
4. **Payload 4 (Unsanctioned Task Creation)**: Worker attempts to create and self-assign a collection task. (DENIED)
5. **Payload 5 (Cross-Worker State Mutation)**: Worker `worker_A` attempts to update the status of a task assigned to `worker_B`. (DENIED)
6. **Payload 6 (Worker Field Poisoning)**: Worker attempts to change `assignedWorkerUid` or `locationId` during status update. (DENIED)
7. **Payload 7 (Complaint Impersonation)**: User `user_A` submits a complaint with `citizenUid: "user_B"`. (DENIED)
8. **Payload 8 (Citizen Self-Resolution)**: Citizen attempts to update their complaint `status` to 'Resolved'. (DENIED)
9. **Payload 9 (Oversized Payload / Denial of Wallet)**: Submitting a complaint description with > 2,000 characters or invalid coordinates. (DENIED)
10. **Payload 10 (Unauthorized Complaint Deletion)**: Non-admin citizen attempts to delete a complaint. (DENIED)
11. **Payload 11 (Audit Trail Tampering)**: Any user attempts to delete or update an existing record in `/taskStatusHistory`. (DENIED)
12. **Payload 12 (Ghost Field Injection)**: Adding unauthorized fields (`isAdmin: true`, `verified: true`) to a task or complaint. (DENIED)

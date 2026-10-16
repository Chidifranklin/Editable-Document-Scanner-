import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface ScanItem {
  id: string;
  userId: string;
  title: string;
  text: string;
  createdAt: any; // Timestamp or ISO string
  updatedAt?: any;
  engine: 'cloud' | 'tesseract';
  language?: string;
  characterCount: number;
  wordCount: number;
  thumbnailUrl?: string;
  syncedToCloud?: boolean;
}

const LOCAL_STORAGE_KEY = 'scantext_scans_cache';

// Helper to get local cache
export function getLocalScans(): ScanItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local scans cache:', e);
    return [];
  }
}

// Helper to save local cache
export function saveLocalScans(scans: ScanItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scans.slice(0, 100)));
  } catch (e) {
    console.warn('LocalStorage quota or write error:', e);
  }
}

/**
 * Save or update a scan document
 */
export async function saveScanRecord(item: Omit<ScanItem, 'id' | 'createdAt'> & { id?: string }): Promise<ScanItem> {
  const scanId = item.id || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const currentUser = auth.currentUser;
  const uid = currentUser ? currentUser.uid : 'guest';

  const fullScan: ScanItem = {
    ...item,
    id: scanId,
    userId: uid,
    createdAt: new Date().toISOString(),
    characterCount: item.text.length,
    wordCount: item.text.trim() ? item.text.trim().split(/\s+/).length : 0,
    syncedToCloud: false,
  };

  // Always update local cache immediately for offline resilience
  const localList = getLocalScans();
  const existingIdx = localList.findIndex((s) => s.id === scanId);
  if (existingIdx >= 0) {
    localList[existingIdx] = { ...localList[existingIdx], ...fullScan };
  } else {
    localList.unshift(fullScan);
  }
  saveLocalScans(localList);

  // If signed in, sync to Firestore
  if (currentUser) {
    const docPath = `users/${currentUser.uid}/scans/${scanId}`;
    try {
      const docRef = doc(db, 'users', currentUser.uid, 'scans', scanId);
      await setDoc(docRef, {
        id: scanId,
        userId: currentUser.uid,
        title: fullScan.title || 'Untitled Scan',
        text: fullScan.text || '',
        createdAt: serverTimestamp(),
        engine: fullScan.engine,
        language: fullScan.language || 'English',
        characterCount: fullScan.characterCount,
        wordCount: fullScan.wordCount,
        thumbnailUrl: fullScan.thumbnailUrl || '',
      });
      fullScan.syncedToCloud = true;

      // Update sync flag locally
      const updatedList = getLocalScans().map((s) => (s.id === scanId ? { ...s, syncedToCloud: true } : s));
      saveLocalScans(updatedList);
    } catch (error) {
      console.warn('Could not sync scan to Firestore (saved locally):', error);
      // Catch and rethrow or return fullScan with handleFirestoreError if online
      if (navigator.onLine) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    }
  }

  return fullScan;
}

/**
 * Fetch scan history for current user (or offline local storage)
 */
export async function fetchUserScans(): Promise<ScanItem[]> {
  const currentUser = auth.currentUser;
  const localScans = getLocalScans();

  if (!currentUser) {
    return localScans;
  }

  const collectionPath = `users/${currentUser.uid}/scans`;
  try {
    const q = query(collection(db, 'users', currentUser.uid, 'scans'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const cloudScans: ScanItem[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let createdDate = new Date().toISOString();
      if (data.createdAt instanceof Timestamp) {
        createdDate = data.createdAt.toDate().toISOString();
      } else if (data.createdAt) {
        createdDate = String(data.createdAt);
      }

      cloudScans.push({
        id: docSnap.id,
        userId: currentUser.uid,
        title: data.title || 'Untitled Scan',
        text: data.text || '',
        createdAt: createdDate,
        engine: data.engine || 'cloud',
        language: data.language,
        characterCount: data.characterCount || (data.text ? data.text.length : 0),
        wordCount: data.wordCount || 0,
        thumbnailUrl: data.thumbnailUrl,
        syncedToCloud: true,
      });
    });

    // Merge cloud scans with local scans to ensure unsynced offline records aren't lost
    const mergedMap = new Map<string, ScanItem>();
    localScans.forEach((s) => mergedMap.set(s.id, s));
    cloudScans.forEach((s) => mergedMap.set(s.id, s));

    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    saveLocalScans(mergedList);
    return mergedList;
  } catch (error) {
    console.warn('Failed to fetch from Firestore, falling back to local cached scans:', error);
    if (navigator.onLine) {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
    return localScans;
  }
}

/**
 * Delete a scan from both local cache and Firestore
 */
export async function deleteScanRecord(scanId: string): Promise<void> {
  // Remove from local cache immediately
  const localScans = getLocalScans().filter((s) => s.id !== scanId);
  saveLocalScans(localScans);

  const currentUser = auth.currentUser;
  if (currentUser) {
    const docPath = `users/${currentUser.uid}/scans/${scanId}`;
    try {
      const docRef = doc(db, 'users', currentUser.uid, 'scans', scanId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }
}

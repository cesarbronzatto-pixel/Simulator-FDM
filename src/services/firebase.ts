import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  doc,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { HistoryEntry } from '../types';
import { isAdmin as checkIsAdmin } from '../constants';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();

export const isMock = false;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}

export async function saveSession(entry: Omit<HistoryEntry, 'id' | 'date'>) {
  const path = 'history';
  try {
    const data = {
      ...entry,
      date: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, path), data);
    return { ...data, id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const path = 'history';
  try {
    const historyRef = collection(db, path);
    let q;
    
    const isAdminUser = checkIsAdmin(auth.currentUser?.email);

    if (!isAdminUser && auth.currentUser) {
      q = query(historyRef, where('userId', '==', auth.currentUser.uid), orderBy('date', 'desc'));
    } else {
      q = query(historyRef, orderBy('date', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any)
    } as HistoryEntry));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteHistoryEntry(id: string) {
  const path = `history/${id}`;
  try {
    const docRef = doc(db, 'history', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

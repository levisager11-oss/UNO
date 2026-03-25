import { create } from 'zustand';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

export interface User {
  id: string;
  username: string;
  games_played: number;
  games_won: number;
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          set({ 
            user: {
              id: firebaseUser.uid,
              username: data.username,
              games_played: data.gamesPlayed || 0,
              games_won: data.wins || 0,
              avatar: data.avatar || null
            },
            loading: false 
          });

          // Listen for real-time updates to stats
          onSnapshot(doc(firestore, 'users', firebaseUser.uid), (doc) => {
            if (doc.exists()) {
               const data = doc.data();
               set({ 
                 user: {
                   id: firebaseUser.uid,
                   username: data.username,
                   games_played: data.gamesPlayed || 0,
                   games_won: data.wins || 0,
                   avatar: data.avatar || null
                 }
               });
            }
          });
        } else {
          set({ loading: false });
        }
      } else {
        set({ user: null, loading: false });
      }
    });
  },

  signIn: async (email, pass) => {
    await signInWithEmailAndPassword(auth, email, pass);
  },

  signUp: async (email, pass, username) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    await setDoc(doc(firestore, 'users', user.uid), {
      username,
      gamesPlayed: 0,
      wins: 0,
      avatar: null
    });
  },

  logout: async () => {
    await signOut(auth);
  }
}));

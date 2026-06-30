import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";

const provider = new GoogleAuthProvider();

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, provider);
}

export async function signOutUser() {
  await signOut(auth);
}

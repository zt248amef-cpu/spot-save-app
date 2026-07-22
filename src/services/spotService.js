import {
  collection,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const spotsCol = collection(db, "spots");

// Storageへの画像保存など、ドキュメント作成前にIDを確定させたい処理のために
// Firestoreの自動採番IDだけを事前発行する（この時点ではまだ書き込みしない）。
export function createSpotId() {
  return doc(spotsCol).id;
}

// ログイン中ユーザーの spots をリアルタイム購読する
export function subscribeToSpots(userId, callback, onError) {
  const q = query(spotsCol, where("userId", "==", userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const spots = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString() ?? null,
      }));
      callback(spots);
    },
    (error) => {
      console.error("Firestore 読み込みエラー:", error.code, error.message);
      if (onError) onError(error);
    }
  );
}

// スポットを追加する（保存演出のため、新規ドキュメントのIDを返す）。
// options.id を渡すと、そのIDでドキュメントを作成する
// （Storageの保存パスとFirestoreのドキュメントIDを一致させたい場合に使う）。
export async function addSpot(userId, data, { id } = {}) {
  const docRef = id ? doc(spotsCol, id) : doc(spotsCol);
  await setDoc(docRef, {
    ...data,
    userId,
    favorite: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// スポットを更新する
export async function updateSpot(id, data) {
  await updateDoc(doc(db, "spots", id), data);
}

// スポットを削除する
export async function deleteSpot(id) {
  await deleteDoc(doc(db, "spots", id));
}

// お気に入りをトグルする
export async function toggleFavorite(id, newValue) {
  await updateDoc(doc(db, "spots", id), { favorite: newValue });
}

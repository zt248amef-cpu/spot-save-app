import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const spotsCol = collection(db, "spots");

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

// スポットを追加する（保存演出のため、新規ドキュメントのIDを返す）
export async function addSpot(userId, data) {
  const docRef = await addDoc(spotsCol, {
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

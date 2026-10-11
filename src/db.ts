import { type Data, initial } from "./model";
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("voimatreeni", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("data");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error("Sulje muut Voimatreeni-välilehdet ja yritä uudelleen."));
  }));
}
export async function load(): Promise<Data> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("data").objectStore("data").get("state");
    r.onsuccess = () => resolve(r.result ?? initial());
    r.onerror = () => reject(r.error);
  });
}
export async function persist(data: Data) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("data", "readwrite");
    tx.objectStore("data").put(data, "state");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

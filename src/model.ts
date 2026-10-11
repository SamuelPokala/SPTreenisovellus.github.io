export type Exercise = {
  id: string;
  name: string;
  count: number;
  reps: number;
  rest: number;
  superset: string | null;
};
export type Program = { id: string; name: string; exercises: Exercise[] };
export type SetEntry = { kg: number; reps: number; done: boolean };
export type Workout = {
  id: string;
  programId: string;
  name: string;
  date: string;
  exercises: (Exercise & { sets: SetEntry[] })[];
};
export type Data = {
  version: 1;
  programs: Program[];
  sessions: Workout[];
  active: Workout | null;
};
export const id = () => crypto.randomUUID();
export const dateToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const exercise = (name = "Uusi liike"): Exercise => ({
  id: id(),
  name,
  count: 3,
  reps: 5,
  rest: 180,
  superset: null,
});
export const initial = (): Data => ({
  version: 1,
  programs: [
    {
      id: id(),
      name: "Voima A",
      exercises: [
        exercise("Kyykky"),
        exercise("Romanialainen maastaveto"),
        { ...exercise("Askelkyykky"), reps: 8 },
      ],
    },
    {
      id: id(),
      name: "Voima B",
      exercises: [
        exercise("Maastaveto"),
        exercise("Jalkaprässi"),
        { ...exercise("Pohjenousu"), reps: 12 },
      ],
    },
  ],
  sessions: [],
  active: null,
});
export const volume = (w: Workout) =>
  w.exercises.reduce(
    (v, e) =>
      v + e.sets.filter((s) => s.done).reduce((a, s) => a + s.kg * s.reps, 0),
    0,
  );
export const epley = (kg: number, reps: number) =>
  reps === 1 ? kg : kg * (1 + reps / 30);
export function startWorkout(program: Program, sessions: Workout[]): Workout {
  return {
    id: id(),
    programId: program.id,
    name: program.name,
    date: dateToday(),
    exercises: orderSupersets(program.exercises).map((e) => {
      const prev = [...sessions]
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((w) => w.exercises)
        .find(
          (x) =>
            x.name.trim().toLocaleLowerCase("fi") ===
            e.name.trim().toLocaleLowerCase("fi"),
        );
      const done = prev?.sets.filter((s) => s.done);
      return {
        ...e,
        sets: Array.from({ length: e.count }, (_, i) => ({
          kg: done?.[i]?.kg ?? done?.at(-1)?.kg ?? 0,
          reps: done?.[i]?.reps ?? done?.at(-1)?.reps ?? e.reps,
          done: false,
        })),
      };
    }),
  };
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";
const num = (v: unknown, min: number, max: number, integer = false) =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= min &&
  v <= max &&
  (!integer || Number.isInteger(v));
const text = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 100;
const uniqueIds = (items: unknown[]) => {
  const ids = items.map(item => obj(item) ? item.id : undefined);
  return new Set(ids).size === ids.length;
};
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
};
const validExercise = (e: unknown) =>
  obj(e) &&
  text(e.id) &&
  text(e.name) &&
  num(e.count, 1, 20, true) &&
  num(e.reps, 1, 100, true) &&
  num(e.rest, 0, 1800, true) &&
  (e.superset === null || text(e.superset));
function validWorkout(w: unknown): boolean {
  return (
    obj(w) &&
    text(w.id) &&
    text(w.programId) &&
    text(w.name) &&
    validDate(w.date) &&
    Array.isArray(w.exercises) &&
    w.exercises.length > 0 &&
    w.exercises.length <= 100 &&
    uniqueIds(w.exercises) &&
    w.exercises.every(
      (e) =>
        validExercise(e) &&
        obj(e) &&
        Array.isArray(e.sets) &&
        e.sets.length > 0 &&
        e.sets.length <= 20 &&
        e.sets.every(
          (s) =>
            obj(s) &&
            num(s.kg, 0, 2000) &&
            num(s.reps, 1, 100, true) &&
            typeof s.done === "boolean",
        ),
    )
  );
}
export function parseBackup(raw: string): Data {
  if (raw.length > 10_000_000)
    throw Error("Liian suuri tiedosto (enintään 10 Mt).");
  const d: unknown = JSON.parse(raw);
  if (
    !obj(d) ||
    d.version !== 1 ||
    !Array.isArray(d.programs) ||
    d.programs.length > 100 ||
    !uniqueIds(d.programs) ||
    !d.programs.every(
      (p) =>
        obj(p) &&
        text(p.id) &&
        text(p.name) &&
        Array.isArray(p.exercises) &&
        p.exercises.length <= 100 &&
        uniqueIds(p.exercises) &&
        p.exercises.every(validExercise),
    ) ||
    !Array.isArray(d.sessions) ||
    d.sessions.length > 10000 ||
    !uniqueIds(d.sessions) ||
    !d.sessions.every(validWorkout) ||
    (d.active !== null && !validWorkout(d.active))
  )
    throw Error("Tiedosto ei ole kelvollinen Voimatreeni-varmuuskopio.");
  return d as Data;
}

/** Pair the chosen exercises and place the partner immediately after the source. */
export function pairSuperset(program: Program, sourceId: string, partnerId: string): Program {
  const source = program.exercises.find(e => e.id === sourceId);
  const partner = program.exercises.find(e => e.id === partnerId);
  if (!source || (partnerId && (!partner || partnerId === sourceId))) return program;
  const group = partner ? id() : null;
  const exercises = program.exercises.map(e => {
    if (e.id === sourceId || e.id === partnerId) return { ...e, superset: group };
    if (e.superset && (e.superset === source.superset || e.superset === partner?.superset)) {
      return { ...e, superset: null };
    }
    return e;
  });
  if (!partner) return { ...program, exercises };
  const pairedPartner = exercises.find(e => e.id === partnerId)!;
  const ordered = exercises.filter(e => e.id !== partnerId);
  ordered.splice(ordered.findIndex(e => e.id === sourceId) + 1, 0, pairedPartner);
  return { ...program, exercises: ordered };
}

/** Keep every valid pair adjacent; discard orphaned/ambiguous group markers. */
export function orderSupersets<T extends Exercise>(exercises: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const e of exercises) if (e.superset) groups.set(e.superset, [...(groups.get(e.superset) ?? []), e]);
  const result: T[] = [];
  const seen = new Set<string>();
  for (const e of exercises) {
    if (seen.has(e.id)) continue;
    const pair = e.superset ? groups.get(e.superset) : undefined;
    if (pair?.length === 2) {
      result.push(...pair); pair.forEach(x => seen.add(x.id));
    } else {
      result.push(e.superset ? {...e, superset: null} : e); seen.add(e.id);
    }
  }
  return result;
}
export function repairSupersets(data: Data): Data {
  const programs = data.programs.map(p => ({...p, exercises: orderSupersets(p.exercises)}));
  const program = programs.find(p => p.id === data.active?.programId);
  const active = data.active ? {...data.active, exercises: orderSupersets(data.active.exercises.map(e => {
    const definition = program?.exercises.find(x => x.id === e.id);
    return definition ? {...e, superset: definition.superset} : e;
  }))} : null;
  return {...data, programs, active};
}
export function supersetLabel(exercises: Exercise[], exerciseId: string): string | null {
  const e = exercises.find(x => x.id === exerciseId);
  if (!e?.superset) return null;
  const pair = exercises.filter(x => x.superset === e.superset);
  if (pair.length !== 2) return null;
  const groups = [...new Set(exercises.map(x => x.superset).filter(Boolean))];
  return `Supersetti ${groups.indexOf(e.superset) + 1} · ${pair[0].id === e.id ? 'A' : 'B'}`;
}

import { describe, it, expect } from "vitest";
import { initial, startWorkout, volume, epley, parseBackup, pairSuperset, exercise } from "./model";
describe("training model", () => {
  it("calculates completed volume and Epley estimate", () => {
    const d = initial(),
      w = startWorkout(d.programs[0], []);
    w.exercises[0].sets[0] = { kg: 60, reps: 5, done: true };
    w.exercises[0].sets[1] = { kg: 200, reps: 1, done: false };
    expect(volume(w)).toBe(300);
    expect(epley(60, 5)).toBe(70);
    expect(epley(60, 1)).toBe(60);
  });
  it("suggests previous completed sets without checking them", () => {
    const d = initial(),
      w = startWorkout(d.programs[0], []);
    w.exercises[0].sets[0] = { kg: 70, reps: 6, done: true };
    const next = startWorkout(d.programs[0], [w]);
    expect(next.exercises[0].sets[0]).toEqual({ kg: 70, reps: 6, done: false });
    expect(next.exercises[0].sets[2].kg).toBe(70);
  });
  it("roundtrips backups including active workout", () => {
    const d = initial();
    d.active = startWorkout(d.programs[0], []);
    expect(parseBackup(JSON.stringify(d))).toEqual(d);
  });
  it("rejects wrong versions, invalid loads, malformed active workouts", () => {
    const d = initial();
    expect(() => parseBackup('{"version":2}')).toThrow();
    d.active = startWorkout(d.programs[0], []);
    d.active.exercises[0].sets[0].kg = -5;
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    expect(() => parseBackup("null")).toThrow();
  });
  it("rejects duplicate IDs and impossible calendar dates", () => {
    const d = initial();
    d.programs.push(d.programs[0]);
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    d.programs.pop();
    d.active = startWorkout(d.programs[0], []);
    d.active.date = "2026-02-30";
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });

});

describe("superset order", () => {
  it.each([[0, 3, [0, 3, 1, 2]], [3, 0, [1, 2, 3, 0]], [1, 2, [0, 1, 2, 3]]])("moves partner after source (%s, %s)", (source, partner, expected) => {
    const exercises = ["A", "B", "C", "D"].map(name => exercise(name));
    const program = {id: "program", name: "Test", exercises};
    const result = pairSuperset(program, exercises[source as number].id, exercises[partner as number].id);
    expect(result.exercises.map(e => e.name)).toEqual((expected as number[]).map(i => exercises[i].name));
    expect(result.exercises.find(e => e.id === exercises[source as number].id)?.superset).toBe(result.exercises.find(e => e.id === exercises[partner as number].id)?.superset);
    expect(program.exercises.map(e => e.name)).toEqual(["A", "B", "C", "D"]);
  });
  it("clears former pairs and unpairs without changing order", () => {
    const [a,b,c,d] = ["A","B","C","D"].map(name => exercise(name));
    a.superset=b.superset="old1";c.superset=d.superset="old2";
    const result=pairSuperset({id:"program",name:"Test",exercises:[a,b,c,d]},a.id,d.id);
    expect(result.exercises.map(e=>e.name)).toEqual(["A","D","B","C"]);
    expect(result.exercises.slice(2).every(e=>e.superset===null)).toBe(true);
    const unpaired=pairSuperset(result,a.id,"");
    expect(unpaired.exercises.map(e=>e.name)).toEqual(["A","D","B","C"]);
    expect(unpaired.exercises.every(e=>e.superset===null)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { initial, startWorkout, volume, epley, parseBackup } from "./model";
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

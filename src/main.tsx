import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { load, persist } from "./db";
import {
  type Data,
  type Program,
  type Workout,
  exercise,
  id,
  startWorkout,
  volume,
  epley,
  parseBackup,
  pairSuperset,
  orderSupersets,
  repairSupersets,
  supersetLabel,
} from "./model";
import "./style.css";
import {NumberInput} from "./NumberInput";
function App() {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("treeni"),
    [editing, setEditing] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [saveState, setSaveState] = useState(""),
    [movement, setMovement] = useState(""),
    [restEnd, setRestEnd] = useState<number | null>(null),
    [now, setNow] = useState(Date.now()),
    [online, setOnline] = useState(navigator.onLine),
    [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  const queue = useRef(Promise.resolve()),
    ready = useRef(false),
    pending = useRef(false);
  useEffect(() => {
    load()
      .then((d) => {
        setData(d);
        ready.current = true;
      })
      .catch(() =>
        setMessage(
          "Tietokantaa ei voitu avata. Salli selaimen tallennus ja lataa sivu uudelleen.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!data || !ready.current) return;
    pending.current = true;
    setSaveState("Tallennetaan…");
    const snapshot = data;
    queue.current = queue.current
      .catch(() => {})
      .then(() => persist(snapshot))
      .then(() => {
        if (snapshot === latest.current) {
          pending.current = false;
          setSaveState("Tallennettu laitteelle");
        }
      })
      .catch(() => {
        setSaveState("Tallennus epäonnistui");
        setMessage(
          "Selaintallennus epäonnistui. Vie varmuuskopio ennen sivun sulkemista.",
        );
      });
  }, [data]);
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOnline(navigator.onLine);
    const before = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeunload", before);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  useEffect(() => {
    import("virtual:pwa-register").then(({ registerSW }) => {
      const updater = registerSW({
        onNeedRefresh: () => setUpdate(() => () => updater(true)),
        onOfflineReady: () =>
          setMessage("Sovellus on valmis myös offline-käyttöön."),
      });
    });
  }, []);
  const change = (fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d));
  const modifyProgram = (pid: string, fn: (p: Program) => Program) =>
    change((d) => ({
      ...d,
      programs: d.programs.map((p) => (p.id === pid ? (() => { const updated = fn(p); return {...updated, exercises: orderSupersets(updated.exercises)}; })() : p)),
    }));
  const active = data?.active;
  const modifyActive = (fn: (w: Workout) => Workout) =>
    change((d) => ({ ...d, active: d.active ? fn(d.active) : null }));
  const remaining = restEnd
    ? Math.max(0, Math.ceil((restEnd - now) / 1000))
    : 0;
  const begin = (p: Program) => {
    if (!p.exercises.length) {
      setMessage("Lisää ohjelmaan ensin liike.");
      return;
    }
    change((d) => ({ ...d, active: startWorkout(p, d.sessions) }));
    setTab("treeni");
    setRestEnd(null);
  };
  if (!data)
    return (
      <main>
        <h1>Voimatreeni</h1>
        <p role="status">{message || "Avataan päiväkirjaa…"}</p>
      </main>
    );
  const selected = data.programs.find((p) => p.id === editing);
  const movements = [
    ...new Set(data.sessions.flatMap((w) => w.exercises.map((e) => e.name))),
  ].sort((a, b) => a.localeCompare(b, "fi"));
  const selectedMovement = movements.includes(movement)
    ? movement
    : movements[0];
  const points = [...data.sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((w) => {
      const sets = w.exercises
        .filter((e) => e.name === selectedMovement)
        .flatMap((e) => e.sets)
        .filter((s) => s.done);
      return sets.length
        ? [
            {
              id: w.id,
              date: w.date,
              weight: Math.max(...sets.map((s) => s.kg)),
              rm: Math.max(...sets.map((s) => epley(s.kg, s.reps))),
              volume: sets.reduce((a, s) => a + s.kg * s.reps, 0),
            },
          ]
        : [];
    });
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">VOIMAA PYÖRÄILYYN</span>
          <h1>
            Voimatreeni<span className="dot">.</span>
          </h1>
        </div>
        <span className="badge">{online ? "Laitteellasi" : "Offline"}</span>
      </header>
      <p className="subtitle">Vahvempi sarja. Vahvempi ajaja.</p>
      <nav aria-label="Päänavigaatio">
        {[
          ["treeni", "Treeni"],
          ["ohjelmat", "Ohjelmat"],
          ["kehitys", "Kehitys"],
          ["historia", "Historia"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            onClick={() => {
              setTab(key);
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {update && (
        <button
          onClick={() => {
            if (!active && !pending.current) void update();
            else setMessage("Tallenna tai lopeta treeni ennen päivitystä.");
          }}
        >
          Uusi versio saatavilla · päivitä
        </button>
      )}
      {tab === "treeni" && (
        <>
          <div className="section-head">
            <h2>{active ? "Treeni käynnissä" : "Aloita harjoitus"}</h2>
            <span className="muted">
              {active ? "OMA TAHTI" : "1–2 × VIIKOSSA"}
            </span>
          </div>
          {!active ? (
            <>
              <p className="muted">
                Valitse ohjelma. Edellisen treenin painot ja toistot ovat
                valmiina.
              </p>
              {data.programs.map((p, i) => (
                <article className="card program" key={p.id}>
                  <span className="number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.exercises.length} liikettä ·{" "}
                      {p.exercises.reduce((a, e) => a + e.count, 0)} sarjaa
                    </p>
                  </div>
                  <button className="primary" onClick={() => begin(p)}>
                    Aloita →
                  </button>
                </article>
              ))}
              {!data.programs.length && (
                <button onClick={() => setTab("ohjelmat")}>
                  Luo ensimmäinen ohjelma
                </button>
              )}
              <aside className="card tip">
                <span>✦</span>
                <div>
                  <h3>Laatu ennen määrää</h3>
                  <p>
                    Kirjaa sarja, kuittaa valmiiksi ja keskity palautumiseen.
                    Päiväkirja muistaa loput.
                  </p>
                </div>
              </aside>
            </>
          ) : (
            <>
              <div className="card">
                <h3>{active.name}</h3>
                <label>
                  Päivämäärä
                  <input
                    type="date"
                    value={active.date}
                    onChange={(e) =>
                      modifyActive((w) => ({ ...w, date: e.target.value }))
                    }
                  />
                </label>
                <p className="muted">
                  {
                    active.exercises
                      .flatMap((e) => e.sets)
                      .filter((s) => s.done).length
                  }{" "}
                  / {active.exercises.flatMap((e) => e.sets).length} sarjaa
                  tehty · {volume(active).toLocaleString("fi-FI")} kg volyymi
                </p>
              </div>
              <div
                className={"timer " + (restEnd ? "running" : "")}
                role="status"
              >
                <div>
                  <span className="eyebrow">PALAUTUS</span>
                  <strong>
                    {restEnd
                      ? remaining
                        ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                        : "Valmis seuraavaan sarjaan"
                      : "Kuittaa sarja → ajastin alkaa"}
                  </strong>
                </div>
                {restEnd && (
                  <button onClick={() => setRestEnd(null)}>Ohita</button>
                )}
              </div>
              {active.exercises.map((e, ei) => (
                <article className="card workout" key={e.id}>
                  <div className="section-head">
                    <h3>{e.name}</h3>
                    <span className="badge">
                      {supersetLabel(active.exercises, e.id) ?? `${e.rest} s`}
                    </span>
                  </div>
                  <p className="muted">
                    Tavoite {e.reps} toistoa · palautus {e.rest} s
                    {e.superset && <> · Pari: {active.exercises.find(x => x.id !== e.id && x.superset === e.superset)?.name}</>}
                  </p>
                  <div className="set headings">
                    <span>#</span>
                    <span>Paino · kg</span>
                    <span>Toistot</span>
                    <span>Valmis</span>
                  </div>
                  {e.sets.map((s, si) => (
                    <div className={"set " + (s.done ? "done" : "")} key={si}>
                      <span>{si + 1}</span>
                      <NumberInput
                        aria-label={`${e.name} sarja ${si + 1} paino`}
                        inputMode="decimal"
                        min="0"
                        max="2000"
                        step="0.25"
                        value={s.kg}
                        onChange={(ev) => {
                          const kg = Number(ev.target.value);
                          if (Number.isFinite(kg) && kg >= 0 && kg <= 2000)
                            modifyActive((w) => ({
                              ...w,
                              exercises: w.exercises.map((x, i) =>
                                i === ei
                                  ? {
                                      ...x,
                                      sets: x.sets.map((t, j) =>
                                        j === si ? { ...t, kg } : t,
                                      ),
                                    }
                                  : x,
                              ),
                            }));
                        }}
                      />
                      <NumberInput
                        aria-label={`${e.name} sarja ${si + 1} toistot`}
                        inputMode="numeric"
                        min="1"
                        max="100"
                        value={s.reps}
                        onChange={(ev) => {
                          const reps = Number(ev.target.value);
                          if (
                            Number.isInteger(reps) &&
                            reps >= 0 &&
                            reps <= 100
                          )
                            modifyActive((w) => ({
                              ...w,
                              exercises: w.exercises.map((x, i) =>
                                i === ei
                                  ? {
                                      ...x,
                                      sets: x.sets.map((t, j) =>
                                        j === si ? { ...t, reps } : t,
                                      ),
                                    }
                                  : x,
                              ),
                            }));
                        }}
                      />
                      <button
                        className={s.done ? "checked" : "check"}
                        aria-label={`${e.name} sarja ${si + 1} valmis`}
                        aria-pressed={s.done}
                        onClick={() => {
                          modifyActive((w) => ({
                            ...w,
                            exercises: w.exercises.map((x, i) =>
                              i === ei
                                ? {
                                    ...x,
                                    sets: x.sets.map((t, j) =>
                                      j === si ? { ...t, done: !t.done } : t,
                                    ),
                                  }
                                : x,
                            ),
                          }));
                          if (!s.done) {
                            const pair = active.exercises.find(
                              (x) =>
                                x.superset &&
                                x.superset === e.superset &&
                                x.id !== e.id,
                            );
                            const wait =
                              pair?.sets[si] && !pair.sets[si].done
                                ? 0
                                : e.rest;
                            setRestEnd(wait ? Date.now() + wait * 1000 : null);
                          }
                        }}
                      >
                        {s.done ? "✓" : "○"}
                      </button>
                    </div>
                  ))}
                </article>
              ))}
              <button
                className="primary wide"
                onClick={() => {
                  if (
                    !active.date ||
                    !active.exercises.some((e) => e.sets.some((s) => s.done))
                  ) {
                    setMessage(
                      "Valitse päivämäärä ja kuittaa vähintään yksi sarja.",
                    );
                    return;
                  }
                  change((d) => ({
                    ...d,
                    sessions: [
                      ...d.sessions,
                      {
                        ...active,
                        exercises: active.exercises
                          .filter((e) => e.sets.some((s) => s.done))
                          .map((e) => ({
                            ...e,
                            sets: e.sets.filter((s) => s.done),
                          })),
                      },
                    ],
                    active: null,
                  }));
                  setRestEnd(null);
                  setMessage("Treeni tallennettu. Hyvää palautumista!");
                }}
              >
                Tallenna treeni
              </button>
              <button
                className="danger wide"
                onClick={() => {
                  if (confirm("Hylätäänkö keskeneräinen treeni?")) {
                    change((d) => ({ ...d, active: null }));
                    setRestEnd(null);
                  }
                }}
              >
                Hylkää treeni
              </button>
            </>
          )}
        </>
      )}
      {tab === "ohjelmat" && (
        <>
          <div className="section-head">
            <h2>Omat ohjelmat</h2>
            <button
              className="primary"
              onClick={() => {
                const p = { id: id(), name: "Uusi ohjelma", exercises: [] };
                change((d) => ({ ...d, programs: [...d.programs, p] }));
                setEditing(p.id);
              }}
            >
              + Uusi
            </button>
          </div>
          {selected ? (
            <>
              <button onClick={() => setEditing(null)}>
                ← Kaikki ohjelmat
              </button>
              <div className="card">
                <label>
                  Ohjelman nimi
                  <input
                    maxLength={100}
                    value={selected.name}
                    onChange={(e) =>
                      modifyProgram(selected.id, (p) => ({
                        ...p,
                        name: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      if (!selected.name.trim())
                        modifyProgram(selected.id, (p) => ({
                          ...p,
                          name: "Nimetön ohjelma",
                        }));
                    }}
                  />
                </label>
              </div>
              {selected.exercises.map((e, i) => (
                <div className="card" key={e.id}>
                  <label>
                    Liikkeen nimi
                    <input
                      maxLength={100}
                      value={e.name}
                      onChange={(ev) =>
                        modifyProgram(selected.id, (p) => ({
                          ...p,
                          exercises: p.exercises.map((x) =>
                            x.id === e.id ? { ...x, name: ev.target.value } : x,
                          ),
                        }))
                      }
                      onBlur={() => {
                        if (!e.name.trim())
                          modifyProgram(selected.id, (p) => ({
                            ...p,
                            exercises: p.exercises.map((x) =>
                              x.id === e.id
                                ? { ...x, name: "Nimetön liike" }
                                : x,
                            ),
                          }));
                      }}
                    />
                  </label>
                  <div className="three">
                    {[
                      ["count", "Sarjat", 20],
                      ["reps", "Toistot", 100],
                      ["rest", "Palautus · s", 1800],
                    ].map(([key, label, max]) => (
                      <label key={key}>
                        {label}
                        <NumberInput
                          inputMode="numeric"
                          min={key === "rest" ? 0 : 1}
                          max={max}
                          value={e[key as "count" | "reps" | "rest"]}
                          onChange={(ev) => {
                            const v = Number(ev.target.value);
                            if (
                              Number.isInteger(v) &&
                              v >= (key === "rest" ? 0 : 1) &&
                              v <= Number(max)
                            )
                              modifyProgram(selected.id, (p) => ({
                                ...p,
                                exercises: p.exercises.map((x) =>
                                  x.id === e.id ? { ...x, [key]: v } : x,
                                ),
                              }));
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="actions">
                    <button
                      aria-label={`Siirrä ${e.name} ylös`}
                      disabled={i === 0}
                      onClick={() =>
                        modifyProgram(selected.id, (p) => {
                          const a = [...p.exercises];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          return { ...p, exercises: a };
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Siirrä ${e.name} alas`}
                      disabled={i === selected.exercises.length - 1}
                      onClick={() =>
                        modifyProgram(selected.id, (p) => {
                          const a = [...p.exercises];
                          [a[i], a[i + 1]] = [a[i + 1], a[i]];
                          return { ...p, exercises: a };
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`Poistetaanko ${e.name}?`))
                          modifyProgram(selected.id, (p) => ({
                            ...p,
                            exercises: p.exercises
                              .filter((x) => x.id !== e.id)
                              .map((x) =>
                                x.superset === e.superset
                                  ? { ...x, superset: null }
                                  : x,
                              ),
                          }));
                      }}
                    >
                      Poista
                    </button>
                  </div>
                  <label>
                    Supersettipari
                    <select
                      aria-label="Supersettipari"
                      value={
                        selected.exercises.find(
                          (x) =>
                            x.id !== e.id &&
                            x.superset &&
                            x.superset === e.superset,
                        )?.id || ""
                      }
                      onChange={(ev) => {
                        const partner = ev.target.value;
                        modifyProgram(selected.id, p => pairSuperset(p, e.id, partner));
                      }}
                    >
                      <option value="">Ei supersettiä</option>
                      {selected.exercises
                        .filter((x) => x.id !== e.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="muted">
                    Parin molemmat sarjat tehdään ennen palautusta.
                  </p>
                </div>
              ))}
              <button
                className="wide"
                disabled={selected.exercises.length >= 100}
                onClick={() =>
                  modifyProgram(selected.id, (p) => ({
                    ...p,
                    exercises: [...p.exercises, exercise()],
                  }))
                }
              >
                + Lisää liike
              </button>
              <button
                className="danger wide"
                onClick={() => {
                  if (confirm("Poistetaanko ohjelma? Historia säilyy.")) {
                    change((d) => ({
                      ...d,
                      programs: d.programs.filter((p) => p.id !== selected.id),
                    }));
                    setEditing(null);
                  }
                }}
              >
                Poista ohjelma
              </button>
            </>
          ) : (
            data.programs.map((p) => (
              <article className="card program" key={p.id}>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.exercises.length} liikettä</p>
                </div>
                <button onClick={() => setEditing(p.id)}>Muokkaa →</button>
              </article>
            ))
          )}
        </>
      )}
      {tab === "kehitys" && (
        <>
          <h2>Voimatasojen kehitys</h2>
          {!points.length && !movements.length ? (
            <div className="card">
              <h3>Ensimmäinen treeni on lähtöpiste.</h3>
              <p>
                Tallenna treeni, niin näet painot, arvioidun maksimivoiman ja
                volyymin täällä.
              </p>
            </div>
          ) : (
            <>
              <label>
                Liike
                <select
                  aria-label="Liike"
                  value={selectedMovement}
                  onChange={(e) => setMovement(e.target.value)}
                >
                  {movements.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="stats">
                <div className="card">
                  <span>Paras paino</span>
                  <strong>
                    {Math.max(0, ...points.map((p) => p.weight))}{" "}
                    <small>kg</small>
                  </strong>
                </div>
                <div className="card">
                  <span>Arvioitu 1RM</span>
                  <strong>
                    {Math.max(0, ...points.map((p) => p.rm)).toFixed(1)}{" "}
                    <small>kg</small>
                  </strong>
                </div>
              </div>
              <div className="card">
                <h3>Sarjapainon kehitys</h3>
                <svg
                  viewBox="0 0 340 170"
                  role="img"
                  aria-label={`${selectedMovement}: suurin sarjapaino treeneittäin`}
                >
                  <path d="M25 15V140H325" stroke="#3e4c54" fill="none" />
                  {[0, 0.5, 1].map((n) => (
                    <g key={n}>
                      <line
                        x1="25"
                        x2="325"
                        y1={140 - n * 110}
                        y2={140 - n * 110}
                        stroke="#25323b"
                      />
                      <text
                        x="25"
                        y={135 - n * 110}
                        fill="#99a9b2"
                        fontSize="10"
                      >
                        {Math.round(
                          n * Math.max(1, ...points.map((p) => p.weight)),
                        )}{" "}
                        kg
                      </text>
                    </g>
                  ))}
                  <polyline
                    fill="none"
                    stroke="#b8ef62"
                    strokeWidth="3"
                    points={points
                      .map(
                        (p, i) =>
                          `${points.length === 1 ? 175 : 30 + (i * 290) / (points.length - 1)},${140 - (p.weight / Math.max(1, ...points.map((p) => p.weight))) * 110}`,
                      )
                      .join(" ")}
                  />
                  {points.map((p, i) => (
                    <circle
                      key={p.id}
                      cx={
                        points.length === 1
                          ? 175
                          : 30 + (i * 290) / (points.length - 1)
                      }
                      cy={
                        140 -
                        (p.weight /
                          Math.max(1, ...points.map((p) => p.weight))) *
                          110
                      }
                      r="4"
                      fill="#b8ef62"
                    >
                      <title>
                        {p.date}: {p.weight} kg
                      </title>
                    </circle>
                  ))}
                </svg>
                <div className="section-head muted">
                  <span>{points[0]?.date}</span>
                  <span>{points.at(-1)?.date}</span>
                </div>
              </div>
              <p className="muted">
                1RM: Epley, paino × (1 + toistot / 30). Yhden toiston sarjalle
                käytetään kirjattua painoa. Arvio on suuntaa antava, etenkin
                pitkissä sarjoissa.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Päivä</th>
                      <th>Paino</th>
                      <th>1RM</th>
                      <th>Volyymi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.id}>
                        <td>
                          {new Date(p.date + "T12:00").toLocaleDateString(
                            "fi-FI",
                          )}
                        </td>
                        <td>{p.weight} kg</td>
                        <td>{p.rm.toFixed(1)} kg</td>
                        <td>{p.volume.toLocaleString("fi-FI")} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      {tab === "historia" && (
        <>
          <h2>Harjoitushistoria</h2>
          <p className="muted">
            {data.sessions.length} harjoitusta · yhteensä{" "}
            {data.sessions
              .reduce((a, w) => a + volume(w), 0)
              .toLocaleString("fi-FI")}{" "}
            kg
          </p>
          {!data.sessions.length && <p>Ei vielä kirjattuja harjoituksia.</p>}
          {[...data.sessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((w) => (
              <article className="card" key={w.id}>
                <details>
                  <summary>
                    <strong>{w.name}</strong>
                    <span>
                      {new Date(w.date + "T12:00").toLocaleDateString("fi-FI")}{" "}
                      · {volume(w).toLocaleString("fi-FI")} kg
                    </span>
                  </summary>
                  {w.exercises.map((e) => (
                    <div key={e.id}>
                      <h4>{e.name}</h4>
                      <p>
                        {e.sets
                          .map((s) => `${s.kg} kg × ${s.reps}`)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </details>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm("Poistetaanko harjoitus pysyvästi?"))
                      change((d) => ({
                        ...d,
                        sessions: d.sessions.filter((x) => x.id !== w.id),
                      }));
                  }}
                >
                  Poista harjoitus
                </button>
              </article>
            ))}
          <div className="card">
            <h3>Varmuuskopio</h3>
            <p>
              Tiedot säilyvät tämän selaimen tässä laitteessa. Vie kopio
              säännöllisesti. Palautus korvaa ohjelmat, historian ja
              keskeneräisen treenin.
            </p>
            <button
              className="wide"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `voimatreeni-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              ↓ Vie JSON-varmuuskopio
            </button>
            <label className="import">
              Palauta JSON-varmuuskopio
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const input = e.currentTarget,
                    f = input.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 10_000_000)
                      throw Error("Tiedosto saa olla enintään 10 Mt.");
                    const imported = repairSupersets(parseBackup(await f.text()));
                    if (
                      confirm(
                        "Korvataanko kaikki nykyiset tiedot varmuuskopiolla?",
                      )
                    ) {
                      await queue.current.catch(() => {});
                      await persist(imported);
                      setData(imported);
                      setRestEnd(null);
                      setEditing(null);
                      setMessage("Varmuuskopio palautettu.");
                    }
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Palautus epäonnistui.",
                    );
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </label>
          </div>
        </>
      )}
      <footer>
        <span role="status">{saveState}</span>
        <p>Ei tiliä. Ei pilveä. Sinun harjoittelusi.</p>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

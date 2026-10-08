// Exercise order + supersets, shared by the workout screen and the routine editor.
// `linked` on an item = "in a superset with the next item". A superset (group) is a run of linked items plus the one after.
// All helpers return a new array and never leave a dangling link (the last item of a group is never linked).

export type Linkable = { linked?: boolean };

export function groupBounds(a: Linkable[], i: number): [number, number] {
  let s = i, e = i;
  while (s > 0 && a[s - 1].linked) s--;
  while (e < a.length - 1 && a[e].linked) e++;
  return [s, e];
}

export const inGroup = (a: Linkable[], i: number) => { const [s, e] = groupBounds(a, i); return s !== e; };

// Moves the whole superset containing i one slot up or down (past the neighbouring superset as a whole).
export function moveGroup<T extends Linkable>(a: T[], i: number, dir: -1 | 1): T[] {
  const [s, e] = groupBounds(a, i);
  if (dir < 0) {
    if (s === 0) return a;
    const [ps] = groupBounds(a, s - 1);
    return [...a.slice(0, ps), ...a.slice(s, e + 1), ...a.slice(ps, s), ...a.slice(e + 1)];
  }
  if (e === a.length - 1) return a;
  const [, ne] = groupBounds(a, e + 1);
  return [...a.slice(0, s), ...a.slice(e + 1, ne + 1), ...a.slice(s, e + 1), ...a.slice(ne + 1)];
}

export function removeAt<T extends Linkable>(a: T[], i: number): T[] {
  const [s, e] = groupBounds(a, i);
  const out = a.slice();
  if (i === e && i > s) out[i - 1] = { ...out[i - 1], linked: false }; // removing the last of a group: close it off
  out.splice(i, 1);
  return out;
}

// Puts j into i's superset: j moves to just after the end of i's group.
export function pair<T extends Linkable>(a: T[], i: number, j: number): T[] {
  const [s, e] = groupBounds(a, i);
  if (i === j || (j >= s && j <= e)) return a;
  const item = { ...a[j], linked: false };
  let out = removeAt(a, j);
  const [, end] = groupBounds(out, j < i ? i - 1 : i);
  out = out.slice();
  out[end] = { ...out[end], linked: true };
  out.splice(end + 1, 0, item);
  return out;
}

// Takes i out of its superset and places it right after what's left of the group.
export function detach<T extends Linkable>(a: T[], i: number): T[] {
  const [s, e] = groupBounds(a, i);
  if (s === e) return a;
  const out = removeAt(a, i);
  out.splice(e, 0, { ...a[i], linked: false });
  return out;
}

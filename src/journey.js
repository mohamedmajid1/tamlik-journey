// The journey's camera: one continuous move through Muscat that flies in through the window of each department's
// flat, and back out again.
//   Flights are splines in city space (the tower film's world). A room is linked to its city window by a rigid map
//   (a turn about the vertical and a shift): the room's window (scene.door) sits exactly on the city window, so a camera
//   in the city has a matching camera in the room. Flying in, the city camera heads for the room's first shot as seen
//   from the city; the room's own rig takes over at the moment it arrives there. Flying out is the same in reverse.
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const inOutSine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
const yawOf = (n) => Math.atan2(n.x, n.z);

// ---- rooms and their windows ------------------------------------------------------------------------------------
// where the camera crosses the window plane moving backwards from a shot (pos looking at target)
function crossing(shot, nd, d) {
  const p = V3(shot.x, shot.y, shot.z), back = p.clone().sub(V3(shot.tx, shot.ty, shot.tz)).setY(0).normalize();
  const k = back.dot(nd);
  return k > 0.05 ? p.addScaledVector(back, (d - p.dot(nd)) / k) : null;
}
// the room side of a window: centre, size, and the frame (n outward, a along the wall) from the scene's door and shots
export function roomWindow(scene) {
  const door = scene.door, nd = V3(...door.n), ad = new THREE.Vector3().crossVectors(UP, nd);
  const [s0, s1] = scene.shots();
  const along = [s0, s1].map((s) => crossing(s, nd, door.d)).filter(Boolean).map((p) => p.dot(ad));
  const lo = door.span[0], hi = door.span[1];
  let w = clamp(Math.max(...along) - Math.min(...along) + 2.0, 3.0, hi - lo);
  let mid = clamp((Math.max(...along) + Math.min(...along)) / 2, lo + w / 2, hi - w / 2);
  const h = door.y[1] - door.y[0];
  const c = nd.clone().multiplyScalar(door.d).addScaledVector(ad, mid).setY((door.y[0] + door.y[1]) / 2);
  return { c, n: nd, a: ad, w, h, d: door.d };
}
// the rigid map between a city window and a room window
export function link(cityWin, roomWin) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yawOf(roomWin.n) - yawOf(cityWin.n));   // city -> room
  const qi = q.clone().invert();
  return {
    toRoom: (p) => p.clone().sub(cityWin.c).applyQuaternion(q).add(roomWin.c),
    toCity: (p) => p.clone().sub(roomWin.c).applyQuaternion(qi).add(cityWin.c),
    qToRoom: (r) => q.clone().multiply(r),
    // the plane the room is cut at while seen from outside: keep the room side (dot(n, p) <= d)
    plane: new THREE.Plane(roomWin.n.clone().negate(), roomWin.d - 0.005),
    // signed distance of a city point outside the window (> 0 outside)
    outside: (p) => p.clone().sub(cityWin.c).dot(cityWin.n),
    cityWin, roomWin,
  };
}

// ---- flights: key poses along a spline -------------------------------------------------------------------------
// keys: { p, l (look-at point), fov (vertical, degrees), roll?, shift? (view offset, fraction of width) }
export function flight(keys, t0, t1, { ease = inOutSine, sway = 1 } = {}) {
  const pc = new THREE.CatmullRomCurve3(keys.map((k) => k.p), false, 'centripetal');
  const N = keys.length;
  // arc-length fraction at each key, so look targets, lens and roll arrive together with the position
  const L = pc.getLengths(N * 200), total = L[L.length - 1];
  const uk = keys.map((_, i) => L[Math.round(i / (N - 1) * N * 200)] / total);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zq = new THREE.Quaternion(), Z = V3(0, 0, 1);
  const out = { pos: V3(0, 0, 0), quat: new THREE.Quaternion(), fov: 45, shift: 0 };
  return {
    t0, t1, keys, length: total,
    at(ms) {
      const x = clamp((ms - t0) / (t1 - t0), 0, 1), u = ease(x);
      pc.getPointAt(u, out.pos);
      let i = 0; while (i < N - 2 && u > uk[i + 1]) i++;
      const f = clamp((u - uk[i]) / (uk[i + 1] - uk[i] || 1), 0, 1);
      const e = f * f * (3 - 2 * f);
      // the look point glides from key to key (a spline through look points that repeat would overshoot and swing)
      const look = keys[i].l.clone().lerp(keys[i + 1].l, e);
      out.fov = keys[i].fov + (keys[i + 1].fov - keys[i].fov) * e;
      out.shift = (keys[i].shift || 0) + ((keys[i + 1].shift || 0) - (keys[i].shift || 0)) * e;
      const roll = (keys[i].roll || 0) + ((keys[i + 1].roll || 0) - (keys[i].roll || 0)) * e;
      out.quat.setFromRotationMatrix(m.lookAt(out.pos, look, UP));
      if (roll) out.quat.multiply(zq.setFromAxisAngle(Z, roll));
      // a slow hand-held drift mid-flight, none at either end (where the camera meets a room)
      const w = sway * Math.pow(Math.sin(Math.PI * x), 2), t = ms / 1000;
      if (w > 0) {
        out.pos.x += Math.sin(t * 0.37) * 1.2 * w; out.pos.y += Math.sin(t * 0.53) * 0.8 * w;
        q.setFromEuler(new THREE.Euler(Math.sin(t * 0.09 + 1.3) * 0.009 * w, Math.sin(t * 0.13) * 0.016 * w, 0));
        out.quat.multiply(q);
      }
      return out;
    },
  };
}

// a room's shot seen from the city: { p, l } in city space, with the room's lens
export function shotInCity(lk, shot, fov, shift = 0) {
  return { p: lk.toCity(V3(shot.x, shot.y, shot.z)), l: lk.toCity(V3(shot.tx, shot.ty, shot.tz)), fov, shift };
}
// the approach to a room: a far and a near key on the line the room's first shot looks along, then the shot itself
export function approach(lk, shot, fov, shift = 0, { far = 26, rise = 4 } = {}) {
  const k = shotInCity(lk, shot, fov, shift), back = k.p.clone().sub(k.l).normalize();
  return [
    { p: k.p.clone().addScaledVector(back, far).addScaledVector(UP, rise), l: k.l.clone(), fov, shift },
    { p: k.p.clone().addScaledVector(back, 5), l: k.l.clone(), fov, shift },
    k,
  ];
}
// leaving a room: its last shot, then backwards out through the middle of the window
export function leave(lk, shot, fov, shift = 0, { back = 6 } = {}) {
  const k = shotInCity(lk, shot, fov, shift), W = lk.cityWin;
  const out = W.c.clone().addScaledVector(W.n, back).setY(k.p.y + 0.6);
  return [k, { p: out, l: k.l.clone(), fov, shift }];
}
export { V3, smooth, clamp, inOutSine };

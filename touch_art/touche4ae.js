// Touch controls for phones and tablets. index.html loads this module on coarse pointers and passes the engine's shared input block:
//   keys  Uint8Array(256): held keys by virtual-key code (0x80 = down)
//   w     Int32Array(10):  w[2] / w[3] look deltas (DX / DY), w[4] wheel notches (DZ), w[5] mouse buttons (BTN: 1 = fire, 2 = aim)
//   VK    the virtual-key table of index.html (key code -> VK)
// Settings are kept per profile (settings/user-<id>.json, next to start.py) and in this browser. The factory set of each profile is the preset in this file; it is never overwritten.
// Movement and driving: every profile except Gamepad has one choice, Analog or Digital. It applies to the walking stick and to the driving controls at the same time.
//   Analog:  the stick, steering wheel, pedal, lever and yoke are one control each.
//   Digital: every direction is its own button (W A S D on foot; LEFT / RIGHT, GAS / BRAKE, THR -/+, ROLL, NOSE in vehicles).
// The values in defaults() are what "Reset" restores. If storage is blocked the defaults apply and nothing else breaks.

const STORE = 'gta5-touch-js-v1';
const PROFILE_KEY = STORE+'-profile';
const DX = 2, DY = 3, DZ = 4, BTN = 5;
const FIRE = 1, AIM = 2;                 // mouse bits (index.html: left button = 1, right button = 2)
const LOOK_BASE = 1.6;
// the look bar: shown 1-5 (3 is normal). The stored value is the real speed factor: 3 -> 2, 5 -> about 4
const lookShown = (m) => 3 * Math.pow(m / 2, 1 / 1.36);
const lookFromShown = (d) => 2 * Math.pow(d / 3, 1.36);                   // look units per CSS pixel at sensitivity 1 (scaled by devicePixelRatio)
const STICK_RING = 15;                   // stick ring radius in vmin at size 1 (the ring drawn by the CSS below is 30 vmin wide)
const SIZE = { XL: 24, L: 17, M: 12, S: 9 };     // control sizes in vmin at button size 1
const STICK_AT = { h: 'left', x: 4, v: 'bottom', y: 4 };
const WASD = { up: 0x57, down: 0x53, left: 0x41, right: 0x44 };
const KEY_LABEL = { Space: 'SPACE', ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL', AltLeft: 'L ALT', AltRight: 'R ALT',
ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Backspace: 'BACK', Escape: 'ESC', Tab: 'TAB', Enter: 'ENTER', NumpadEnter: 'NUM ENTER',
CapsLock: 'CAPS', MetaLeft: 'WIN', MetaRight: 'WIN' };
const keyLabel = (code) => (!code ? '—' : KEY_LABEL[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad(?=\d)/, 'NUM '));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clone = (o) => JSON.parse(JSON.stringify(o));
const plainObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const MODS = ['ControlLeft', 'ShiftLeft', 'AltLeft'];
const AXIS_VERSION = 18;                 // bump when a preset gains or changes driving controls or keys: older saved settings are repaired once
let VKEYS = {};                          // the key codes of index.html, set when the module starts (used to check imported settings)

// The buttons. type: 'mouse' (bit), 'key' (default key code, can be rebound), 'wheel' (weapon notches per tap), 'page' (an action of the page).
// defMode: the mode it starts in (hold, toggle = Lock, tap). at: default position, canonical (right-handed) form.
// The key codes are GTA V's PC defaults as the published control guides list them. The guides disagree on a few (horn, radio, lights, crouch / stealth,
// boat anchor, motorcycle handbrake, aircraft keys): those are marked in the notes of the presets below. Check them in the game's own controls
// and rebind them in the button settings if your game differs.
const CONTROLS = [
{ id: 'fire', label: 'FIRE', type: 'mouse', bit: FIRE, size: 'L', at: { h: 'right', x: 4, v: 'bottom', y: 6 } },
{ id: 'aim', label: 'AIM', type: 'mouse', bit: AIM, size: 'M', noToggle: true, at: { h: 'right', x: 24, v: 'bottom', y: 10 } },
{ id: 'jump', label: 'JUMP', type: 'key', code: 'Space', size: 'M', at: { h: 'right', x: 6, v: 'bottom', y: 32 } },
{ id: 'enter', label: 'ENTER<br>VEH', type: 'key', code: 'KeyF', size: 'M', at: { h: 'right', x: 24, v: 'bottom', y: 36 } },
{ id: 'reload', label: 'RELOAD', type: 'key', code: 'KeyR', size: 'M', at: { h: 'right', x: 38, v: 'bottom', y: 24 } },
{ id: 'use', label: 'USE', type: 'key', code: 'KeyE', size: 'S', at: { h: 'right', x: 38, v: 'bottom', y: 40 } },
{ id: 'cover', label: 'COVER', type: 'key', code: 'KeyQ', size: 'S', at: { h: 'left', x: 36, v: 'bottom', y: 40 } },
{ id: 'crouch', label: 'LOOK<br>BACK', type: 'key', code: 'KeyC', size: 'M', defMode: 'hold', at: { h: 'left', x: 36, v: 'bottom', y: 8 } },
{ id: 'sprint', label: 'SPRINT', type: 'key', code: 'ShiftLeft', size: 'M', defMode: 'toggle', at: { h: 'left', x: 36, v: 'bottom', y: 24 } },
{ id: 'melee', label: 'MELEE', type: 'key', code: 'KeyR', size: 'S', at: { h: 'left', x: 50, v: 'bottom', y: 8 } },
{ id: 'phone', label: 'UP', type: 'key', code: 'ArrowUp', size: 'S', at: { h: 'left', x: 13, v: 'top', y: 30 } },
{ id: 'left', label: 'LEFT', type: 'key', code: 'ArrowLeft', size: 'S', at: { h: 'left', x: 2, v: 'top', y: 39 } },
{ id: 'right', label: 'RIGHT', type: 'key', code: 'ArrowRight', size: 'S', at: { h: 'left', x: 24, v: 'top', y: 39 } },
{ id: 'down', label: 'DOWN', type: 'key', code: 'ArrowDown', size: 'S', at: { h: 'left', x: 13, v: 'top', y: 48 } },
{ id: 'weapons', label: 'WEAPON<br>WHEEL', type: 'key', code: 'Tab', size: 'S', at: { h: 'right', x: 66, v: 'bottom', y: 48 } },
{ id: 'wup', label: 'WPN<br>UP', type: 'wheel', step: 1, size: 'S', at: { h: 'right', x: 66, v: 'bottom', y: 24 } },
{ id: 'wdown', label: 'WPN<br>DOWN', type: 'wheel', step: -1, size: 'S', at: { h: 'right', x: 66, v: 'bottom', y: 36 } },
{ id: 'fps', label: 'FPS', type: 'page', action: 'fps', size: 'S', at: { h: 'left', x: 24, v: 'top', y: 13 } },
{ id: 'map', label: 'MENU', type: 'key', code: 'KeyM', size: 'S', at: { h: 'left', x: 2, v: 'top', y: 13 } },
{ id: 'horn', label: 'HORN', type: 'key', code: 'KeyE', size: 'S', at: { h: 'right', x: 2, v: 'top', y: 13 } },
{ id: 'radio', label: 'RADIO', type: 'key', code: 'KeyQ', size: 'S', at: { h: 'right', x: 13, v: 'top', y: 13 } },
{ id: 'esc', label: 'ESC', type: 'key', code: 'Escape', size: 'S', at: { h: 'left', x: 2, v: 'top', y: 2 } },
{ id: 'ok', label: 'OK', type: 'key', code: 'Enter', size: 'S', at: { h: 'left', x: 13, v: 'top', y: 2 } },
{ id: 'back', label: 'BACK', type: 'key', code: 'Backspace', size: 'S', at: { h: 'left', x: 24, v: 'top', y: 2 } },
];
// The prompt for an AI assistant: the user copies it, adds the request, and pastes back the one-line command it returns.
const BASE_PROMPT = [
'Add a touch button for GTA V. Output ONE LINE in exactly this format, and nothing else:',
'',
'button=<short name>;label=<short caption shown on the button>;key=<key code>;action=<hold|lock|tap>;mods=<optional: ControlLeft,ShiftLeft,AltLeft>;size=<optional: 0.5 - 2>',
'',
'Rules:',
'- key is a keyboard key code name: KeyA ... KeyZ, Digit1 ... Digit9, Numpad0 ... Numpad9, Space, Tab, Enter, Escape, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShiftLeft, ControlLeft, AltLeft, F1 ... F12.',
'- action: hold = active while held down; lock = tap once to turn on, tap again to turn off; tap = press and release on a single tap.',
'- Pick a key that does not clash with the default keys of the game and suits the function.',
'',
'For a driving control (steering wheel, gas/brake pedal, aircraft yoke, throttle lever): kind=wheel|pedal|lever;button=<name>;key=<right or forward key>;key2=<left or back key>;ramp=<seconds>',
'',
'Request: ',
].join('\n');
// Extra buttons the player starts with (any key can be added in the settings). The first one is the game's own hint: "hold L Alt to show the available characters".
const CUSTOM_DEFAULT = [{ id: 'k_altl', key: 'AltLeft', mode: 'hold', at: { h: 'left', x: 13, v: 'top', y: 13 } }];

// On-foot walking keys: shown in Digital mode instead of the stick (the stick is hidden then).
const WASD_AT = {
up: { h: 'left', x: 13, v: 'bottom', y: 18 }, left: { h: 'left', x: 2, v: 'bottom', y: 7 },
down: { h: 'left', x: 13, v: 'bottom', y: 7 }, right: { h: 'left', x: 24, v: 'bottom', y: 7 },
};
const WASD_PARTS = [
{ id: 'wd_up', label: '\u25B2', code: 'KeyW', dir: 'up' }, { id: 'wd_left', label: '\u25C0', code: 'KeyA', dir: 'left' },
{ id: 'wd_down', label: '\u25BC', code: 'KeyS', dir: 'down' }, { id: 'wd_right', label: '\u25B6', code: 'KeyD', dir: 'right' },
];

// The driving controls. Analog: one control per axis (wheel turns, pedal / lever / yoke are dragged). Digital: one button per direction.
const AXIS_KIND = { wheel: 'Steering wheel', pedal: 'Pedal', yoke: 'Yoke', lever: 'Lever' };
const AXIS_KEY_LABELS = {
wheel: { x: ['Left key', 'Right key'] },
pedal: { y: ['Brake key', 'Gas key'] },
yoke: { x: ['Roll left key', 'Roll right key'], y: ['Nose down key', 'Nose up key'] },
lever: { y: ['Thrust down key', 'Thrust up key'] },
};
const AXIS_NOTE = {
wheel: 'Analog: turn the wheel with your finger around its centre; it turns as far as your finger does. In Digital mode, two separate buttons (left / right) appear instead.',
pedal: 'Analog: drag up = gas, drag down = brake. In Digital mode, two separate buttons (gas / brake) appear instead.',
yoke: 'Analog: drag your finger; the direction keys follow proportionally. In Digital mode, four separate buttons appear (right / left, up / down).',
lever: 'Analog: drag the lever up / down. In Digital mode, two separate buttons appear (increase / decrease).',
};
// The digital buttons of an axis, in the order of the axis' keys (kx = left/right or roll, ky = down/up or brake/gas or thrust).
function axisParts(a) {
const p = (pair, idx, label, order) => ({ pair, idx, label, order });
if (a.kind === 'wheel') return [p('kx', 0, 'LEFT', 0), p('kx', 1, 'RIGHT', 1)];
if (a.kind === 'pedal') return [p('ky', 0, 'BRAKE', 0), p('ky', 1, 'GAS', 1)];
if (a.kind === 'lever') return [p('ky', 0, 'THR -', 0), p('ky', 1, 'THR +', 1)];
if (a.kind === 'yoke') return [p('kx', 0, 'ROLL L', 0), p('kx', 1, 'ROLL R', 1), p('ky', 0, 'NOSE DN', 2), p('ky', 1, 'NOSE UP', 3)];
return [];
}
const partId = (axisId, pair, idx) => axisId + '#' + pair + idx;
// Each vehicle's own pictures, by control id (helicopter, plane, boat). The kind icon below is the fallback for any other driving control.
const AXIS_ICON_BY_ID = { a_wheel: 'carWheel', a_gas: 'pedal', h_yoke: 'heliStick', h_lever: 'heliCollective', h_rudder: 'rudder', p_yoke: 'aircraftYoke', p_throttle: 'planeThrottle', p_rudder: 'rudder', b_wheel: 'boatHelm', b_throttle: 'boatThrottle' };
const AXIS_ICON = {
	wheel: '<svg viewBox="0 0 24 24"><g class="spin"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V3M9.8 13.3l-5.2 3M14.2 13.3l5.2 3"/></g></svg>',
	pedal: '<svg viewBox="0 0 24 24"><path d="M7 3h10v6l2 12H5L7 9z"/><rect class="lvl" x="8" y="4" width="8" height="14" rx="1" fill="rgba(255,255,255,.55)" stroke="none"/></svg>',
	yoke: '<svg viewBox="0 0 24 24"><path d="M3 7c4-2.5 14-2.5 18 0"/><path d="M12 8v5"/><g class="grip"><circle cx="12" cy="14" r="4"/></g><path d="M12 18v4"/></svg>',
	lever: '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><rect class="knob" x="8" y="9" width="8" height="6" rx="2"/></svg>',
	heliCollective: '<svg viewBox="0 0 24 24"><path d="M12 6v14M8 6h8M8 20h8"/><rect class="knob" x="9.5" y="11" width="5" height="4" rx="1.5"/></svg>',
	aircraftYoke: '<svg viewBox="0 0 24 24"><g class="grip"><rect x="2.5" y="6" width="3.5" height="5" rx="1.75"/><rect x="18" y="6" width="3.5" height="5" rx="1.75"/><path d="M6 8.5h12M12 8.5V18M9 21h6"/></g></svg>',
	heliStick: '<svg viewBox="0 0 24 24"><g class="grip"><path d="M12 19V11"/><circle cx="12" cy="8.5" r="3"/></g><path d="M8 21h8"/></svg>',
	rudder: '<svg viewBox="0 0 24 24"><g class="grip"><path d="M3 8h7v9H3zM14 8h7v9h-7z"/><path d="M10 12.5h4"/></g></svg>',
	carWheel: '<svg viewBox="0 0 24 24"><g class="spin"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3 12h6.5M14.5 12H21M12 14.5V21"/></g></svg>',
	planeThrottle: '<svg viewBox="0 0 24 24"><path d="M8 3v18M14 5h4M14 9h4M14 13h4M14 17h4"/><rect class="knob" x="5" y="9" width="6" height="5" rx="1.5"/></svg>',
	boatHelm: '<svg viewBox="0 0 24 24"><g class="spin"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4V2M12 20v2M4 12H2M20 12h2M6.3 6.3L4.9 4.9M17.7 17.7l1.4 1.4M6.3 17.7l-1.4 1.4M17.7 6.3l1.4-1.4"/></g></svg>',
	boatThrottle: '<svg viewBox="0 0 24 24"><path d="M9 3v12"/><rect class="knob" x="6" y="5" width="6" height="4" rx="1.5"/><path d="M3 19q2.25-2 4.5 0t4.5 0t4.5 0t4.5 0"/></svg>',
};


// The six fixed profiles. Each has its own starting set (presetFor): buttons shown or hidden, captions, keys and the driving controls of that vehicle.
// The player's own changes are kept per profile in settings/user-<id>.json; reset returns a profile to its preset (presetFor).
const PROFILES = [
{ id: 'yaya', name: 'On foot' }, { id: 'araba', name: 'Car' }, { id: 'motosiklet', name: 'Motorbike' },
{ id: 'helikopter', name: 'Helicopter' }, { id: 'ucak', name: 'Plane' }, { id: 'tekne', name: 'Boat' }, { id: 'gamepad', name: 'Gamepad' },
];
const captionIn = (base, id, label) => { base.btn[id] = { ...(base.btn[id] || {}), label }; return base; };
const addKeyIn = (base, id, key, mode, label, at) => { base.custom.push({ id, key, mode, at }); base.btn[id] = { name: label, label, mods: [], scale: 1 }; return base; };
const addAxisIn = (base, id, kind, kx, ky, name, at, size = 'L') => {
base.ctlAxes.push({ id, kind, kx, ky, ramp: kind === 'wheel' ? 0.15 : 0.45, sens: 1, dead: 0.06, at, size, name });
base.btn[id] = { name, label: '', scale: 1 };
return base;
};
// The built-in buttons each profile uses; every other built-in button is hidden in that profile. Arrow keys follow the eye button (Gamepad always shows them).
const KEEP = {
yaya: ['fire', 'aim', 'jump', 'enter', 'use', 'reload', 'cover', 'crouch', 'sprint', 'melee', 'weapons', 'wup', 'wdown', 'phone', 'map', 'fps', 'esc', 'ok', 'back'],
araba: ['fire', 'aim', 'enter', 'horn', 'radio', 'map', 'esc', 'ok', 'back'],
motosiklet: ['enter', 'horn', 'radio', 'map', 'esc', 'ok', 'back'],
helikopter: ['enter', 'radio', 'map', 'esc', 'ok', 'back'],
ucak: ['enter', 'radio', 'map', 'esc', 'ok', 'back'],
tekne: ['enter', 'horn', 'radio', 'map', 'esc', 'ok', 'back'],
gamepad: ['phone', 'left', 'right', 'down', 'fire', 'aim', 'jump', 'crouch', 'reload', 'enter', 'cover', 'wup', 'sprint', 'melee'],
};
const ARROWS = ['phone', 'left', 'right', 'down'];          // menu / d-pad keys
const ARROW_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
// Keys of the older presets that were wrong. Changed only where the saved key is still the old one (a key the player set is kept).
const KEY_FIX = [
{ axis: 'a_gas', pair: 'ky', from: [null, 'KeyW'], to: ['KeyS', 'KeyW'] },
{ axis: 'h_yoke', pair: 'kx', from: ['KeyJ', 'KeyL'], to: ['Numpad4', 'Numpad6'] },
{ axis: 'h_yoke', pair: 'ky', from: ['KeyK', 'KeyI'], to: ['Numpad8', 'Numpad5'] },
{ axis: 'h_rudder', pair: 'kx', from: ['KeyQ', 'KeyE'], to: ['KeyA', 'KeyD'] },
{ axis: 'p_yoke', pair: 'kx', from: ['KeyJ', 'KeyL'], to: ['Numpad4', 'Numpad6'] },
{ axis: 'p_yoke', pair: 'ky', from: ['KeyK', 'KeyI'], to: ['Numpad8', 'Numpad5'] },
{ axis: 'p_rudder', pair: 'kx', from: ['KeyQ', 'KeyE'], to: ['KeyA', 'KeyD'] },
];
const OBSOLETE_AXES = ['a_brake'];                           // the old separate brake pedal: the gas pedal holds both now

function hideUnused(b, id) {
const keep = KEEP[id];
if (keep) for (const c of CONTROLS) if (!keep.includes(c.id) && !ARROWS.includes(c.id)) b.btn[c.id] = { ...(b.btn[c.id] || {}), hidden: true };
if (id === 'gamepad') return b;
// your own buttons that repeat a driving key or an arrow key are hidden: the driving control already sends them
const drive = (b.ctlAxes || []).flatMap((a) => [...(a.kx || []), ...(a.ky || [])]).filter(Boolean);
for (const k of b.custom || []) if (ARROW_CODES.includes(k.key) || drive.includes(k.key)) b.btn[k.id] = { ...(b.btn[k.id] || {}), hidden: true };
return b;
}
function presetFor(id) { return hideUnused(presetBase(id), id); }
function presetBase(id) {
const base = defaults();
base.axisVersion = AXIS_VERSION;
base.sensFix = base.feelFix = base.sprintFix = base.driveFix = true;   // a factory set is never migrated
const L_AT = (x, y) => ({ h: 'left', x, v: 'bottom', y });
const R_AT = (x, y) => ({ h: 'right', x, v: 'bottom', y });
const at = (cid, p) => { base.layout[cid] = p; };
const part = (axisId, pair, idx, p) => at(partId(axisId, pair, idx), p);
switch (id) {
case 'yaya': {
// the on-foot set: no vehicle buttons; the walking stick (or its W A S D buttons in Digital mode)
base.lookSens = 2;
base.stickSize = 0.6;
base.opacity = 0.9;
base.drive = 'analog';
base.layout = {
enter: { h: 'right', x: 25, v: 'top', y: 39 }, use: { h: 'right', x: 40, v: 'top', y: 40 },
reload: { h: 'right', x: 38, v: 'bottom', y: 37 }, wdown: { h: 'right', x: 59, v: 'bottom', y: 32 },
wup: { h: 'right', x: 59, v: 'bottom', y: 19 }, aim: { h: 'right', x: 37, v: 'bottom', y: 10 },
weapons: { h: 'right', x: 70, v: 'bottom', y: 27 }, jump: { h: 'right', x: 7, v: 'bottom', y: 38 },
fire: { h: 'right', x: 11, v: 'bottom', y: 11 }, cover: { h: 'left', x: 50, v: 'bottom', y: 36 },
sprint: { h: 'right', x: 7, v: 'bottom', y: 53 }, crouch: { h: 'right', x: 22, v: 'bottom', y: 34 },
melee: { h: 'left', x: 50, v: 'bottom', y: 20 },
};
base.btn.fire = { scale: 1.2 };
base.btn.aim = { scale: 1.15 };
base.btn.jump = { scale: 1.1 };
base.btn.k_altl = { scale: 0.85 };
return base;
}
case 'araba': {
// steering on the left thumb; gas / brake on the right; fire, aim and enter on the right; car keys in the middle
base.drive = 'digital'; base.stickOn = false;
addAxisIn(base, 'a_wheel', 'wheel', ['KeyA', 'KeyD'], null, 'Steering', L_AT(2, 6), 'XL');
addAxisIn(base, 'a_gas', 'pedal', null, ['KeyS', 'KeyW'], 'Gas / brake', R_AT(4, 6), 'L');
part('a_wheel', 'kx', 0, L_AT(2, 6)); part('a_wheel', 'kx', 1, L_AT(15, 6));
part('a_gas', 'ky', 0, R_AT(4, 6)); part('a_gas', 'ky', 1, R_AT(4, 20));
at('fire', R_AT(37, 6)); at('aim', R_AT(37, 26)); at('enter', R_AT(56, 6));
at('horn', R_AT(56, 20)); at('radio', R_AT(70, 6)); at('map', R_AT(66, 20));
base.modes.radio = 'tap';
addKeyIn(base, 'v_lights', 'KeyL', 'tap', 'LIGHTS', L_AT(32, 6));
addKeyIn(base, 'v_hbrake', 'Space', 'hold', 'H.BRAKE', L_AT(32, 20));
addKeyIn(base, 'v_camera', 'KeyV', 'tap', 'CAMERA', L_AT(45, 6));
addKeyIn(base, 'v_lookback', 'KeyC', 'hold', 'BEHIND', L_AT(45, 20));
addKeyIn(base, 'v_roof', 'KeyY', 'hold', 'ROOF', L_AT(58, 6));
addKeyIn(base, 'v_vwpn', 'Tab', 'tap', 'VEH WPN', R_AT(56, 33));
return base;
}
case 'motosiklet': {
base.drive = 'digital'; base.stickOn = false;
addAxisIn(base, 'a_wheel', 'wheel', ['KeyA', 'KeyD'], null, 'Steering', L_AT(2, 6), 'XL');
addAxisIn(base, 'a_gas', 'pedal', null, ['KeyS', 'KeyW'], 'Throttle / brake', R_AT(4, 6), 'L');
part('a_wheel', 'kx', 0, L_AT(2, 6)); part('a_wheel', 'kx', 1, L_AT(15, 6));
part('a_gas', 'ky', 0, R_AT(4, 6)); part('a_gas', 'ky', 1, R_AT(4, 20));
addKeyIn(base, 'v_hbrake', 'Space', 'hold', 'H.BRAKE', R_AT(24, 6));
at('enter', R_AT(43, 6)); at('horn', R_AT(43, 20)); at('radio', R_AT(43, 33));
base.modes.radio = 'tap';
addKeyIn(base, 'v_leanf', 'ShiftLeft', 'hold', 'LEAN F', L_AT(30, 6));
addKeyIn(base, 'v_leanb', 'ControlLeft', 'hold', 'LEAN B', L_AT(30, 20));
addKeyIn(base, 'v_lights', 'KeyL', 'tap', 'LIGHTS', L_AT(44, 6));
addKeyIn(base, 'v_camera', 'KeyV', 'tap', 'CAMERA', L_AT(44, 20));
addKeyIn(base, 'v_lookback', 'KeyC', 'hold', 'BEHIND', L_AT(57, 6));
return base;
}
case 'helikopter': {
// aircraft keys: roll and pitch on the numpad, throttle W / S, yaw A / D
base.drive = 'digital'; base.stickOn = false;
addAxisIn(base, 'h_yoke', 'yoke', ['Numpad4', 'Numpad6'], ['Numpad8', 'Numpad5'], 'Cyclic', R_AT(4, 6), 'XL');
addAxisIn(base, 'h_lever', 'lever', null, ['KeyS', 'KeyW'], 'Throttle', L_AT(30, 6), 'L');
addAxisIn(base, 'h_rudder', 'wheel', ['KeyA', 'KeyD'], null, 'Yaw', L_AT(48, 6), 'M');
part('h_yoke', 'kx', 0, R_AT(3, 6)); part('h_yoke', 'kx', 1, R_AT(17, 6));
part('h_yoke', 'ky', 0, R_AT(3, 20)); part('h_yoke', 'ky', 1, R_AT(17, 20));
part('h_lever', 'ky', 0, L_AT(30, 6)); part('h_lever', 'ky', 1, L_AT(30, 20));
part('h_rudder', 'kx', 0, L_AT(48, 6)); part('h_rudder', 'kx', 1, L_AT(48, 20));
at('enter', L_AT(66, 6)); at('radio', L_AT(66, 20)); base.modes.radio = 'tap';
addKeyIn(base, 'v_camera', 'KeyV', 'tap', 'CAMERA', L_AT(80, 6));
addKeyIn(base, 'v_lookback', 'KeyC', 'hold', 'BEHIND', L_AT(80, 20));
addKeyIn(base, 'v_vwpn', 'Tab', 'tap', 'VEH WPN', R_AT(3, 33));
return base;
}
case 'ucak': {
base.drive = 'digital'; base.stickOn = false;
addAxisIn(base, 'p_yoke', 'yoke', ['Numpad4', 'Numpad6'], ['Numpad8', 'Numpad5'], 'Yoke', R_AT(4, 6), 'XL');
addAxisIn(base, 'p_throttle', 'lever', null, ['KeyS', 'KeyW'], 'Throttle', L_AT(30, 6), 'L');
addAxisIn(base, 'p_rudder', 'wheel', ['KeyA', 'KeyD'], null, 'Rudder', L_AT(48, 6), 'M');
part('p_yoke', 'kx', 0, R_AT(3, 6)); part('p_yoke', 'kx', 1, R_AT(17, 6));
part('p_yoke', 'ky', 0, R_AT(3, 20)); part('p_yoke', 'ky', 1, R_AT(17, 20));
part('p_throttle', 'ky', 0, L_AT(30, 6)); part('p_throttle', 'ky', 1, L_AT(30, 20));
part('p_rudder', 'kx', 0, L_AT(48, 6)); part('p_rudder', 'kx', 1, L_AT(48, 20));
at('enter', L_AT(66, 6)); at('radio', L_AT(66, 20)); base.modes.radio = 'tap';
addKeyIn(base, 'v_gear', 'KeyG', 'tap', 'GEAR', L_AT(80, 6));
addKeyIn(base, 'v_camera', 'KeyV', 'tap', 'CAMERA', L_AT(80, 20));
addKeyIn(base, 'v_lookback', 'KeyC', 'hold', 'BEHIND', L_AT(93, 6));
addKeyIn(base, 'v_vwpn', 'Tab', 'tap', 'VEH WPN', R_AT(3, 33));
return base;
}
case 'tekne': {
base.drive = 'digital'; base.stickOn = false;
addAxisIn(base, 'b_wheel', 'wheel', ['KeyA', 'KeyD'], null, 'Helm', L_AT(2, 6), 'XL');
addAxisIn(base, 'b_throttle', 'lever', null, ['KeyS', 'KeyW'], 'Throttle', R_AT(4, 6), 'L');
part('b_wheel', 'kx', 0, L_AT(2, 6)); part('b_wheel', 'kx', 1, L_AT(15, 6));
part('b_throttle', 'ky', 0, R_AT(4, 20)); part('b_throttle', 'ky', 1, R_AT(4, 6));
addKeyIn(base, 'v_anchor', 'Space', 'hold', 'ANCHOR', R_AT(24, 6));
at('horn', R_AT(24, 20)); at('enter', R_AT(43, 6)); at('radio', R_AT(43, 20));
base.modes.radio = 'tap';
addKeyIn(base, 'v_lookback', 'KeyC', 'hold', 'BEHIND', L_AT(30, 6));
addKeyIn(base, 'v_camera', 'KeyV', 'tap', 'CAMERA', L_AT(30, 20));
addKeyIn(base, 'v_vwpn', 'Tab', 'tap', 'VEH WPN', R_AT(43, 33));
return base;
}
case 'gamepad': {
// the reference controller: d-pad and stick on the left, ABXY on the right, shoulders and triggers on top, View / Menu in the middle
base.labelStyle = 'text';
base.custom = [];
for (const [cid, label] of [['cover', 'LB'], ['sprint', 'L3'], ['wup', 'RB'], ['aim', 'LT'], ['fire', 'RT'], ['jump', 'A'], ['crouch', 'B'],
['reload', 'X'], ['enter', 'Y'], ['melee', 'R3'], ['phone', '\u25B2'], ['left', '\u25C0'], ['right', '\u25B6'], ['down', '\u25BC']]) captionIn(base, cid, label);
const pos = (h, x, v, y) => ({ h, x, v, y });
base.layout.phone = pos('left', 48, 'bottom', 30);  base.layout.left = pos('left', 39, 'bottom', 21);
base.layout.right = pos('left', 57, 'bottom', 21);  base.layout.down = pos('left', 48, 'bottom', 12);
base.layout.cover = pos('left', 2, 'top', 2);      base.layout.sprint = pos('left', 13, 'top', 2);
base.layout.wup = pos('right', 2, 'top', 13);       base.layout.aim = pos('right', 2, 'top', 24);
base.layout.fire = pos('right', 16, 'top', 13);
base.layout.enter = pos('right', 14, 'bottom', 36); base.layout.reload = pos('right', 26, 'bottom', 26);
base.layout.crouch = pos('right', 2, 'bottom', 26); base.layout.jump = pos('right', 14, 'bottom', 16);
base.layout.melee = pos('right', 30, 'bottom', 6);
base.stickOn = true;
base.stickSize = 0.8;
return base;
}
default: return base;
}
}

const defaults = () => ({
lookSens: 2, invertY: false, dragLook: true, aimSens: 0.5, lookCurve: 0, showArrows: false, shape: 'round', stickDead: 0.3, stickSize: 1, buttonSize: 1, opacity: 0.9, leftHanded: false, haptics: true,
labelStyle: 'icon', drive: 'analog', modes: {}, keys: {}, layout: {}, btn: {}, ctlAxes: [], stickOn: true, stickAt: null, custom: clone(CUSTOM_DEFAULT), savedAt: 0,
});
const factoryOf = (id) => sanitize(presetFor(id));

// ---- settings check: a file may be damaged or hand-edited. Valid parts are kept, broken parts are dropped or set to their default (silently) ----
const keyOk = (k) => typeof k === 'string' && VKEYS[k] !== undefined;
const numIn = (v, lo, hi, def) => (typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : def);
const boolIn = (v, def) => (typeof v === 'boolean' ? v : def);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const validPos = (p) => {
if (!p || typeof p !== 'object') return null;
if ((p.h !== 'left' && p.h !== 'right') || (p.v !== 'top' && p.v !== 'bottom')) return null;
if (typeof p.x !== 'number' || typeof p.y !== 'number' || !isFinite(p.x) || !isFinite(p.y)) return null;
return { h: p.h, v: p.v, x: clamp(p.x, 0, 95), y: clamp(p.y, 0, 95) };
};
const cleanBtn = (b) => {
b = plainObj(b);
const r = {};
if (typeof b.name === 'string') r.name = b.name.slice(0, 24);
if (typeof b.label === 'string') r.label = b.label.slice(0, 16);
if (Array.isArray(b.mods)) r.mods = b.mods.filter((m) => MODS.includes(m));
if (typeof b.scale === 'number' && isFinite(b.scale)) r.scale = clamp(b.scale, 0.5, 2);
if (typeof b.op === 'number' && isFinite(b.op)) r.op = clamp(b.op, 0.2, 1);
if (typeof b.hidden === 'boolean') r.hidden = b.hidden;
if (['round', 'rounded', 'square'].includes(b.shape)) r.shape = b.shape;
return r;
};
const cleanCustom = (k) => {
k = plainObj(k);
if (typeof k.id !== 'string' || !k.id || !keyOk(k.key)) return null;
return { id: k.id.slice(0, 40), key: k.key, mode: oneOf(k.mode, ['hold', 'toggle', 'tap'], 'hold'), at: validPos(k.at) || { h: 'right', x: 50, v: 'top', y: 13 } };
};
const cleanAxis = (a) => {
a = plainObj(a);
if (typeof a.id !== 'string' || !a.id || CONTROLS.some((c) => c.id === a.id)) return null;
const kind = oneOf(a.kind, ['wheel', 'pedal', 'yoke', 'lever'], null);
if (!kind) return null;
const pair = (v) => (Array.isArray(v) ? [keyOk(v[0]) ? v[0] : null, keyOk(v[1]) ? v[1] : null] : null);
return {
id: a.id, kind, kx: pair(a.kx), ky: pair(a.ky),
ramp: numIn(a.ramp, 0.02, 1.5, kind === 'wheel' ? 0.15 : 0.45), sens: numIn(a.sens, 0.2, 5, 1), dead: numIn(a.dead, 0, 0.4, 0.06),
size: oneOf(a.size, ['XL', 'L', 'M', 'S'], 'L'), at: validPos(a.at) || { h: 'right', x: 50, v: 'top', y: 13 },
name: typeof a.name === 'string' ? a.name.slice(0, 24) : '',
};
};
function sanitize(raw) {
const o = plainObj(raw), d = defaults(), out = { ...d };
out.lookSens = numIn(o.lookSens, 0.05, 10, d.lookSens);
out.invertY = boolIn(o.invertY, d.invertY); out.dragLook = boolIn(o.dragLook, true);
out.aimSens = numIn(o.aimSens, 0.1, 1, d.aimSens); out.lookCurve = numIn(o.lookCurve, 0, 1, 0);
out.showArrows = boolIn(o.showArrows, false);
out.shape = oneOf(o.shape, ['round', 'rounded', 'square'], d.shape);
out.stickDead = numIn(o.stickDead, 0, 0.6, d.stickDead); out.stickSize = numIn(o.stickSize, 0.6, 1.6, d.stickSize);
out.buttonSize = numIn(o.buttonSize, 0.6, 1.6, d.buttonSize); out.opacity = numIn(o.opacity, 0.2, 1, d.opacity);
out.leftHanded = boolIn(o.leftHanded, false); out.haptics = boolIn(o.haptics, true);
out.labelStyle = oneOf(o.labelStyle, ['icon', 'text'], d.labelStyle);
out.drive = oneOf(o.drive, ['analog', 'digital'], d.drive);
out.stickOn = boolIn(o.stickOn, true);
out.stickAt = validPos(o.stickAt);
out.layout = {};
for (const [k, v] of Object.entries(plainObj(o.layout))) { const p = validPos(v); if (p) out.layout[k] = p; }
out.modes = {};
for (const [k, v] of Object.entries(plainObj(o.modes))) if (['hold', 'toggle', 'tap'].includes(v)) out.modes[k] = v;
out.keys = {};
for (const [k, v] of Object.entries(plainObj(o.keys))) if (keyOk(v)) out.keys[k] = v;
out.btn = {};
for (const [k, b] of Object.entries(plainObj(o.btn))) out.btn[k] = cleanBtn(b);
out.custom = Array.isArray(o.custom) ? o.custom.map(cleanCustom).filter(Boolean) : d.custom;
const axes = Array.isArray(o.ctlAxes) ? o.ctlAxes.map(cleanAxis).filter(Boolean) : [];
out.ctlAxes = axes.filter((a, i) => axes.findIndex((b) => b.id === a.id) === i);
out.savedAt = numIn(o.savedAt, 0, 1e15, 0);
out.axisVersion = Number.isInteger(o.axisVersion) ? o.axisVersion : undefined;
for (const f of ['sensFix', 'feelFix', 'sprintFix', 'driveFix']) if (o[f] === true) out[f] = true;
return out;
}
// the copy saved last wins: the server's and this browser's copies can differ when a save did not reach the server
const newest = (a, b) => (!a ? b : !b ? a : (b.savedAt || 0) > (a.savedAt || 0) ? b : a);
const localKey = (id) => STORE + ':' + id;
function readLocal(id) { try { return JSON.parse(localStorage.getItem(localKey(id)) || 'null'); } catch (e) { return null; } }
async function readSettings(kind, id) {
return null; // Trial uses the module's per-profile browser copy; this server has no source settings API.
}

// Settings from an older version, brought up to date once (AXIS_VERSION). The player's own values are kept except where the version changed them.
function repairAxes(s, id) {
if (id === 'yaya' && !s.sensFix) { s.lookSens = 1; s.sensFix = true; }
if (!s.feelFix) { if (s.lookSens === 1) s.lookSens = 2; s.feelFix = true; }   // the old normal speed becomes the new normal
if (id === 'yaya' && !s.sprintFix) {
// sprint and crouch move to the right side, next to the other action buttons (the left thumb is on the stick)
s.layout.sprint = { h: 'right', x: 7, v: 'bottom', y: 53 };
s.layout.crouch = { h: 'right', x: 22, v: 'bottom', y: 30 };
s.sprintFix = true;
}
if (!s.driveFix) { s.drive = presetFor(id).drive; s.driveFix = true; }
if ((s.axisVersion || 0) >= AXIS_VERSION) return s;
const preset = presetFor(id);
s.ctlAxes = s.ctlAxes.filter((a) => !OBSOLETE_AXES.includes(a.id));
for (const fx of KEY_FIX) {
const a = s.ctlAxes.find((x) => x.id === fx.axis);
if (a && JSON.stringify(a[fx.pair]) === JSON.stringify(fx.from)) a[fx.pair] = clone(fx.to);
}
for (const a of preset.ctlAxes) {
const mine = s.ctlAxes.find((x) => x.id === a.id);
if (!mine) { s.ctlAxes.push(clone(a)); if (!s.btn[a.id]) s.btn[a.id] = clone(preset.btn[a.id]); }
else mine.size = a.size;
if (!s.layout[a.id]) s.layout[a.id] = clone(a.at);
}
for (const k of preset.custom) {
if (s.custom.some((x) => x.id === k.id)) continue;
s.custom.push(clone(k));
if (!s.btn[k.id]) s.btn[k.id] = clone(preset.btn[k.id] || {});
}
for (const [cid, pos] of Object.entries(preset.layout)) if (!s.layout[cid]) s.layout[cid] = clone(pos);
for (const [cid, m] of Object.entries(preset.modes)) if (!s.modes[cid]) s.modes[cid] = m;
for (const [cid, b] of Object.entries(preset.btn)) if (b.label && CONTROLS.some((c) => c.id === cid) && !(s.btn[cid] || {}).label) s.btn[cid] = { ...(s.btn[cid] || {}), label: b.label };
if (KEEP[id]) s.stickOn = preset.stickOn;
for (const a of ARROWS) if (s.btn[a]) s.btn[a] = { ...s.btn[a], hidden: false };   // the eye decides from now on
for (const cid of KEEP[id] || []) if (s.btn[cid]) s.btn[cid] = { ...s.btn[cid], hidden: false };
if (id === 'gamepad') {
s.labelStyle = preset.labelStyle;
s.stickSize = preset.stickSize;
for (const a of ARROWS) s.layout[a] = clone(preset.layout[a]);
}
if (id === 'yaya') s.opacity = preset.opacity;
hideUnused(s, id);
s.axisVersion = AXIS_VERSION;
return s;
}
const svg = (inner) => '<svg viewBox="0 0 24 24">' + inner + '</svg>';
const MOUSE_BODY = '<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 2.5v7M6 9.5h12"/>';
const ICON = {
	lockClosed: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
	lockOpen: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
	enterFull: svg('<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>'),
	exitFull: svg('<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>'),
	gear: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
	key: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
	eyeOn: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
	eyeOff: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>'),
	mouse: svg(MOUSE_BODY),
	// The pressed half is filled (class b, see CSS): left = FIRE, right = AIM, so the two buttons read apart at a glance
	mouseL: svg('<path class="b" stroke="none" d="M12 2.5A6 6 0 0 0 6 8.5V9.5H12Z"/>' + MOUSE_BODY),
	mouseR: svg('<path class="b" stroke="none" d="M12 2.5A6 6 0 0 1 18 8.5V9.5H12Z"/>' + MOUSE_BODY),
};

// ---- the pictures of the buttons (icon style). Every built-in and vehicle button has its own picture; a key without one falls back to the keyboard picture.
const GLYPH = {
jump: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
arrowUp: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
arrowDown: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
arrowLeft: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
enter: svg('<path d="M5 21V4h10v17M15 21h4"/><circle cx="12" cy="12.5" r=".7"/>'),
reload: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
use: svg('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 3-2 5-5 5h-1c-2 0-3-1-4-2.5l-2-3.5a1.5 1.5 0 0 1 2.5-1.7L8 13"/>'),
cover: svg('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>'),
lookBack: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
sprint: svg('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>'),
melee: svg('<path d="M14.5 3.5l6 6-9 9-6-6z"/><path d="M5 19l-2 2"/>'),
phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
weapons: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>'),
vehWpn: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
fps: ICON.eyeOn,
menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
horn: svg('<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
radio: svg('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l9-5"/><circle cx="8" cy="14" r="2"/><path d="M13.5 13h4.5M13.5 16h4.5"/>'),
light: svg('<path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/><path d="M9.5 19h5M10.5 21.5h3"/>'),
handbrake: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 16.5v-9h3.2a2.4 2.4 0 0 1 0 4.8H9.5"/>'),
roof: svg('<path d="M4 17v-3l3-4.5h10l3 4.5v3z"/><path d="M4 17h16"/><path d="M12 2v4M10 4l2-2 2 2"/>'),
camera: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.5"/>'),
leanF: svg('<path d="M5 17a8 8 0 0 1 13-9"/><path d="M18 3v5h-5"/>'),
leanB: svg('<path d="M19 17a8 8 0 0 0-13-9"/><path d="M6 3v5h5"/>'),
gear: svg('<path d="M12 3v9M8 12h8"/><circle cx="8" cy="17" r="2.5"/><circle cx="16" cy="17" r="2.5"/>'),
anchor: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v13M7.5 11h9M5 15a7 7 0 0 0 14 0"/>'),
esc: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
ok: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
back: svg('<path d="M10 6l-6 6 6 6M4 12h11a4.5 4.5 0 0 1 0 9h-2"/>'),
chars: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
pedal: AXIS_ICON.pedal,
};
// which picture a button uses (by control id), and which one a driving button uses (by its caption)
const BTN_ICON = {
jump: 'jump', enter: 'enter', reload: 'reload', use: 'use', cover: 'cover', crouch: 'lookBack', sprint: 'sprint', melee: 'melee',
phone: 'phone', left: 'arrowLeft', right: 'arrowRight', down: 'arrowDown', weapons: 'weapons', fps: 'fps', map: 'menu',
horn: 'horn', radio: 'radio', esc: 'esc', ok: 'ok', back: 'back', k_altl: 'chars',
wd_up: 'arrowUp', wd_left: 'arrowLeft', wd_down: 'arrowDown', wd_right: 'arrowRight',
v_lights: 'light', v_hbrake: 'handbrake', v_camera: 'camera', v_lookback: 'lookBack', v_roof: 'roof', v_leanf: 'leanF', v_leanb: 'leanB',
v_gear: 'gear', v_anchor: 'anchor', v_vwpn: 'vehWpn',
};
const PART_ICON = { 'LEFT': 'arrowLeft', 'RIGHT': 'arrowRight', 'ROLL L': 'arrowLeft', 'ROLL R': 'arrowRight', 'NOSE UP': 'arrowUp', 'NOSE DN': 'arrowDown', 'GAS': 'pedal', 'BRAKE': 'pedal', 'THR +': 'arrowUp', 'THR -': 'arrowDown' };
const iconOf = (c) => {
if (c.type === 'mouse') return c.bit === FIRE ? ICON.mouseL : ICON.mouseR;
if (c.type === 'wheel') return ICON.mouse;
if (c.part) return GLYPH[PART_ICON[c.label]] || ICON.key;
return GLYPH[BTN_ICON[c.id]] || ICON.key;
};

const CSS = `
#pad { position: fixed; inset: 0; z-index: 12; pointer-events: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: #fff; font: 600 13px sans-serif; }
#pad [hidden] { display: none !important; }
#loading:not(.done) ~ #pad > :not(#fullscr) { visibility: hidden; pointer-events: none; }
#pad .look { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
#pad.editing .look { pointer-events: none; }
#pad .ctl { position: absolute; pointer-events: auto; touch-action: none; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1.1;
	background: rgba(20, 20, 20, .55); border: 2px solid rgba(255, 255, 255, .5); opacity: var(--op, .9); font-size: calc(var(--bs, 1) * 1.8vmin); }
#pad .ctl[data-size="L"] { font-size: calc(var(--bs, 1) * 2.2vmin); }
#pad .ctl.round { border-radius: 50%; }
#pad .ctl.sq { border-radius: 12px; }
#pad .ctl svg { width: 42%; height: 42%; flex: none; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#pad .ctl .cap { margin-top: .4vmin; font-size: .8em; line-height: 1; white-space: nowrap; }
#pad .ctl.on { background: rgba(255, 255, 255, .55); color: #000; }
#pad .ctl.on svg { stroke: #000; }
#pad .ctl svg .b { fill: rgba(255, 255, 255, .85); }
#pad .ctl.on svg .b { fill: #000; }
#pad .modetag { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -.6vmin); padding: .2vmin .9vmin; border-radius: 1vmin; background: #ffd400; color: #000; font: 700 1.7vmin sans-serif; white-space: nowrap; pointer-events: none; }
#tc-rotate { position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 40; padding: 1.4vmin 3vmin; border: 1px solid #777; border-radius: 12px; background: rgba(0, 0, 0, .7); color: #fff; font: 600 3.2vmin sans-serif; pointer-events: auto; max-width: 90vw; }
#tc-rotate[hidden] { display: none !important; }
#pad.editing .ctl { outline: 2px dashed #ff0; outline-offset: 2px; }
#pad.editing .ctl.clash { outline: 2px solid #ff4d4d; }
#stick { width: calc(var(--ss, 1) * 30vmin); height: calc(var(--ss, 1) * 30vmin); }
#stick .knob { position: absolute; left: 50%; top: 50%; width: 38%; height: 38%; margin: -19% 0 0 -19%; border-radius: 50%; background: rgba(255, 255, 255, .45); pointer-events: none; }
#stick .knob.on { background: rgba(255, 255, 255, .6); }
#pad .ui { position: absolute; pointer-events: auto; touch-action: none; box-sizing: border-box; width: calc(var(--bs, 1) * 9vmin); height: calc(var(--bs, 1) * 9vmin); border-radius: 12px;
	background: rgba(20, 20, 20, .55); border: 2px solid rgba(255, 255, 255, .5); display: flex; align-items: center; justify-content: center; opacity: var(--op, .9); }
#pad .ui:active { background: rgba(255, 255, 255, .35); }
#pad .ui svg { width: 58%; height: 58%; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#pad #zoomlock { right: 2vmin; top: 2vmin; }
#pad #fullscr { right: 13vmin; top: 2vmin; }
#pad #gear { right: 24vmin; top: 2vmin; }
#pad #eye { right: 35vmin; top: 2vmin; }
#pad #done { left: 50%; top: 2vmin; transform: translateX(-50%); width: auto; padding: 0 4vmin; height: 9vmin; font: 600 3vmin sans-serif; }
.tc-ui { position: fixed; inset: 0; z-index: 20; box-sizing: border-box; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 0 4vmin 14vmin;
	background: #0d0f12; color: #e8eaed; font: 16px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; user-select: text; -webkit-user-select: text; }
.tc-ui .head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2.5vmin 0; margin-bottom: 1vmin;
	background: rgba(13, 15, 18, .92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.tc-ui h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: .2px; }
.tc-ui .card { background: #161a1f; border: 1px solid #242a31; border-radius: 16px; padding: 1vmin 3vmin 1.5vmin; margin: 0 0 2.5vmin; }
.tc-ui h3 { margin: 1.2vmin 0 .6vmin; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent2, #7cc7ff); }
.tc-ui .note { margin: .4vmin 0 1vmin; font-size: 14px; color: #9aa3ad; }
.tc-ui .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; border-bottom: 1px solid #242a31; }
.tc-ui .card > :last-child { border-bottom: 0; }
.tc-ui .parts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.tc-ui input[type=range] { flex: 1 1 45%; max-width: 55%; accent-color: var(--accent, #4cc2ff); }
.tc-ui input[type=checkbox] { -webkit-appearance: none; appearance: none; position: relative; flex: none; width: 50px; height: 30px; margin: 0; border-radius: 30px; background: #3a414a; cursor: pointer; transition: background .2s; }
.tc-ui input[type=checkbox]::before { content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .4); transition: transform .2s; }
.tc-ui input[type=checkbox]:checked { background: var(--accent, #4cc2ff); }
.tc-ui input[type=checkbox]:checked::before { transform: translateX(20px); }
.tc-ui select, .tc-ui button { font: 15px system-ui, sans-serif; min-height: 40px; min-width: 40px; padding: 0 16px; border-radius: 999px; background: #232930; color: #e8eaed; border: 1px solid #343b44; }
.tc-ui select { padding-right: 28px; }
.tc-ui button:active { background: #2d343d; }
.tc-ui .head button { background: var(--accent, #4cc2ff); color: #06202e; border: 0; font-weight: 700; }
.tc-ui .val { width: 48px; text-align: right; color: #9aa3ad; font-variant-numeric: tabular-nums; }
.tc-ui .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 2vmin; }
.tc-ui .actions button { border-color: #5a2f2f; color: #ffb4a8; }
.tc-ui .saved { margin-left: auto; font-size: 13px; color: #8fd18f; }
.tc-ui details.btnedit { border-top: 1px solid #242a31; padding: .6vmin 0 1vmin; }
.tc-ui details.btnedit > summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; list-style: none; }
.tc-ui details.btnedit > summary::-webkit-details-marker { display: none; }
.tc-ui details.btnedit > summary::after { content: '›'; margin-left: auto; color: var(--accent2, #7cc7ff); font-size: 24px; transition: transform .2s; }
.tc-ui details.btnedit[open] > summary::after { transform: rotate(90deg); }
.tc-ui .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #232930; border: 1px solid #343b44; font-size: 14px; }
.tc-ui .chip input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent, #4cc2ff); }
#pad #addbtn { left: calc(50% + 12vmin); top: 2vmin; font: 300 6vmin sans-serif; }
#tc-sheet { z-index: 25; padding: 2.5vmin 4vmin 5vmin; background: #0d0f12; box-shadow: 0 0 24px rgba(0, 0, 0, .5); }
#tc-sheet .head { position: static; background: none; backdrop-filter: none; padding: 0 0 1vmin; }
#tc-sheet .sheet-tag { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--accent2, #7cc7ff); }
.tc-ui .chip input[type=checkbox] { width: 18px; height: 18px; border-radius: 5px; margin: 0; background: #232930; border: 1px solid #5a6470; }
.tc-ui .chip input[type=checkbox]::before { display: none; }
.tc-ui .chip input[type=checkbox]:checked { background: var(--accent, #4cc2ff); border-color: var(--accent, #4cc2ff); }
.tc-ui input[type=text] { width: 55%; min-height: 44px; box-sizing: border-box; border-radius: 12px; background: #161a1f; color: #e8eaed; border: 1px solid #343b44; padding: 0 12px; font: 15px system-ui, sans-serif; }
.tc-ui textarea.prompt { width: 100%; box-sizing: border-box; background: #161a1f; color: #e8eaed; border: 1px solid #343b44; border-radius: 12px; padding: 10px; font: 13px/1.45 ui-monospace, Menlo, monospace; resize: vertical; }
.tc-ui input.cmd { width: 100%; }
.tc-ui.side-left, .tc-ui.side-right { top: 0; bottom: 0; width: min(46vw, 520px); height: auto; max-width: none; }
.tc-ui.side-left { left: 0; right: auto; border-right: 1px solid #242a31; }
.tc-ui.side-right { right: 0; left: auto; border-left: 1px solid #242a31; }
.tc-ui.top-half { top: 0; bottom: auto; height: 50vh; border-bottom: 1px solid #242a31; }
.tc-ui.bottom-half { bottom: 0; top: auto; height: 50vh; border-top: 1px solid #242a31; }
.ctl.axis .spin { transform: rotate(var(--wa, calc(var(--x, 0) * 80deg))); transform-box: view-box; transform-origin: 12px 12px; }
.ctl.axis .lvl { transform: scaleY(var(--lvl, 0)); transform-box: fill-box; transform-origin: 50% 100%; }
.ctl.axis.fwd .lvl { fill: #8fd8ff; }   .ctl.axis.back .lvl { fill: #ffb070; }
.ctl.axis .grip { transform: translate(calc(var(--x, 0) * 3px), calc(var(--y, 0) * -3px)); }
.ctl.axis .knob { transform: translateY(calc(var(--y, 0) * -5px)); }
.tc-ui .stack { display: flex; flex-direction: column; gap: 10px; padding: 1vmin 0 1.5vmin; }
.tc-ui .stack button { width: 100%; min-height: 48px; border-radius: 12px; border: 1px solid #343b44; background: #232930; color: #e8eaed; font: 600 16px system-ui, sans-serif; }
.tc-ui .stack button.danger { background: #7a1f1f; border-color: #c0392b; color: #fff; }
.tc-ui h3.danger-h { color: #ff6b6b; }
#pad #done { opacity: 1; background: rgba(46, 125, 50, .9); border-color: rgba(165, 214, 167, .9); }
#pad .ctl[data-shape="round"] { border-radius: 50%; }
#pad .ctl[data-shape="rounded"] { border-radius: 26%; }
#pad .ctl[data-shape="square"] { border-radius: 8%; }
.tc-ui .chips { display: flex; flex-wrap: wrap; gap: 8px; }
.tc-ui .chips button { min-height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid #343b44; background: #232930; color: #cfd5dc; font: 600 15px system-ui, sans-serif; }
.tc-ui .chips button.on { background: #2b5d8a; border-color: #6aa8e0; color: #fff; }
.tc-ui .picker { position: relative; margin: 0 0 1vmin; }
.tc-ui .pick { width: 100%; min-height: 46px; border-radius: 12px; border: 1px solid #343b44; background: #232930; color: #e8eaed; font: 600 16px system-ui, sans-serif; text-align: left; padding: 0 14px; }
.tc-ui .pick-list { position: absolute; left: 0; right: 0; top: 100%; z-index: 5; margin-top: 4px; padding: 6px; background: #1e242b; border: 1px solid #343b44; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); }
.tc-ui .pick-list[hidden] { display: none; }
.tc-ui .pick-list button { display: block; width: 100%; min-height: 42px; text-align: left; background: none; border: 0; color: #cfd5dc; font: 600 15px system-ui, sans-serif; padding: 0 10px; border-radius: 8px; }
.tc-ui .pick-list button.on { background: #2b5d8a; color: #fff; }
#tc-box { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 60; width: min(88vw, 420px); box-sizing: border-box; padding: 4vmin; border-radius: 16px; background: #1e242b; border: 1px solid #343b44; color: #e8eaed; font: 16px system-ui, sans-serif; box-shadow: 0 12px 40px rgba(0, 0, 0, .6); }
#tc-box p { margin: 0 0 3vmin; line-height: 1.4; }
#tc-box .stack button.danger { background: #2e6b3a; border-color: #5fbf73; color: #fff; }
#tc-xclose { position: fixed; top: 13vmin; left: 50%; transform: translateX(-50%); width: auto; padding: 0 4vmin; height: 9vmin; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
	border-radius: 12px; background: rgba(20, 20, 20, .7); border: 2px solid rgba(255, 255, 255, .5); color: #fff; font: 600 3vmin sans-serif; z-index: 30; touch-action: none; user-select: none; }
#tc-xclose[hidden] { display: none !important; }
#tc-xclose { opacity: 1; background: rgba(150, 40, 40, .9) !important; border-color: rgba(239, 154, 154, .9) !important; }
`;

// ---- the module -----------------------------------------------------------------------------------------------------------------------------------
export async function installTouchControls({ keys, w, VK, settingsOnly=false }) {
let controlsEnabled=!settingsOnly;
VKEYS = VK;
const doc = document;
const h = (tag, props = {}, ...kids) => {
const n = Object.assign(doc.createElement(tag), props);
// A sheet can appear on pointer-up while the opener's touch/click is still
// being delivered. Only a gesture started inside this new surface may act on it.
if (['tc-panel', 'tc-sheet', 'tc-box'].includes(props.id)) {
let startedHere = false;
n.addEventListener('pointerdown', () => { startedHere = true; }, true);
n.addEventListener('touchstart', () => { startedHere = true; }, { capture: true, passive: true });
const guard = (event) => {
if (!startedHere && !(event.type === 'click' && event.detail === 0)) {
event.preventDefault(); event.stopImmediatePropagation();
}
if (event.type === 'click' || event.type === 'pointercancel') startedHere = false;
};
for (const type of ['pointerup', 'pointercancel', 'touchend', 'click']) n.addEventListener(type, guard, { capture: true, passive: false });
}
for (const k of kids) n.append(k);
return n;
};
const KEY_CHOICES = Object.keys(VK).sort((a, b) => keyLabel(a).localeCompare(keyLabel(b)));

// ---- settings: one profile is active at a time (remembered in this browser). Changes go to settings/user-<id>.json at once,
// except inside the layout editor, which saves when it is closed with Done (or with Save) ----
let profile = (() => { try { const p = localStorage.getItem(PROFILE_KEY); return PROFILES.some((x) => x.id === p) ? p : 'yaya'; } catch (e) { return 'yaya'; } })();
let editing = false, editSnap = null;
let settings = null;
const post = () => Promise.resolve(false); // Browser persistence/export remain active; no production server writes.
function save() {
if (editing) return;
settings.savedAt = Date.now();
const body = JSON.stringify(settings);
try { localStorage.setItem(localKey(profile), body); } catch (e) { /* blocked: the server copy still counts */ }
post('api/settings?kind=user&profile=' + profile, body);
}
// a saved profile, repaired; the repair is written once (save), so it does not run again on the next start
async function fetchProfile(id) {
const raw = newest(await readSettings('user', id), readLocal(id));
if (!raw) return { s: factoryOf(id), migrated: false };
const before = sanitize(raw);
return { s: repairAxes(clone(before), id), migrated: (before.axisVersion || 0) < AXIS_VERSION };
}
{ const r = await fetchProfile(profile); settings = r.s; if (r.migrated) save(); }
// what the layout editor compares: an empty button entry is not a change
const sig = (s) => JSON.stringify({ ...s, btn: Object.fromEntries(Object.entries(s.btn).filter(([, v]) => Object.keys(v).length)) });
const effDrive = () => (profile === 'gamepad' ? 'analog' : settings.drive);
const walkOn = () => profile === 'yaya' || settings.stickOn !== false;   // on foot the walking control is always on
const axisOf = (id) => settings.ctlAxes.find((a) => a.id === id);
// the key of a button: a digital driving button reads the axis, every other button reads its own setting
const keyOf = (c) => {
if (c.part) { const a = axisOf(c.part.axis); return (a && a[c.part.pair] && a[c.part.pair][c.part.idx]) || null; }
return settings.keys[c.id] || c.code || null;
};
function setKeyOf(c, v) {
if (c.part) {
const a = axisOf(c.part.axis);
if (!a) return;
if (!a[c.part.pair]) a[c.part.pair] = [null, null];
a[c.part.pair][c.part.idx] = v;
} else settings.keys[c.id] = v;
}
// hold or lock: the aim is always hold (noToggle); fire, keys and the rest can be locked from the settings
const modeOf = (c) => {
if (c.noToggle || c.type === 'page' || c.type === 'wheel') return 'hold';
const m = settings.modes[c.id] ?? c.defMode ?? 'hold';
return m === 'toggle' || m === 'tap' ? m : 'hold';
};
const flip = (side) => (settings.leftHanded ? (side === 'left' ? 'right' : 'left') : side);
// keys held together with a button (e.g. Ctrl + Q) and the name shown for the button
const mods = (c) => settings.btn[c.id]?.mods || [];
const comboName = (c) => [...mods(c).map(keyLabel), keyLabel(keyOf(c))].join(' + ');

// ---- held state: references, so two controls on one key (or two fingers) do not release each other ----
const keyRefs = new Uint8Array(256);
const btnRefs = [0, 0];                // FIRE, AIM
function holdKey(vk, on) {
if (on) keyRefs[vk]++;
else if (keyRefs[vk]) keyRefs[vk]--;
keys[vk] = keyRefs[vk] ? 0x80 : 0;
}
function holdBit(bit, on) {
const i = bit === FIRE ? 0 : 1;
if (on) { if (btnRefs[i]++ === 0) Atomics.or(w, BTN, bit); }
else if (btnRefs[i] && --btnRefs[i] === 0) Atomics.and(w, BTN, ~bit);
}
function press(c, on) {
if (c.type === 'mouse') holdBit(c.bit, on);
else if (c.type === 'key') {
// modifiers down before the key, up after it; the refcounts keep a key shared by two buttons right
const held = mods(c).map((m) => VK[m]).filter(Boolean);
if (on) for (const v of held) holdKey(v, true);
const vk = VK[keyOf(c)];
if (vk) holdKey(vk, on);
if (!on) for (const v of held) holdKey(v, false);
}
else if (c.type === 'page' && on) window.dispatchEvent(new CustomEvent('tc-action', { detail: c.action }));
}
const buzz = () => { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* not allowed here */ } };

// ---- the pad ----
doc.head.append(h('style', { textContent: CSS }));
const pad = h('div', { id: 'pad' });
const look = h('div', { className: 'look' });
const stickEl = h('div', { id: 'stick', className: 'ctl round' });
const knob = h('div', { className: 'knob' });
stickEl.append(knob);
pad.append(look, stickEl);
const lockBtn = h('div', { id: 'zoomlock', className: 'ui' });
const fullBtn = h('div', { id: 'fullscr', className: 'ui' });
const gearBtn = h('div', { id: 'gear', className: 'ui', title: 'Touch controls settings' });
const eyeBtn = h('div', { id: 'eye', className: 'ui' });
gearBtn.innerHTML = ICON.gear;
const doneBtn = h('div', { id: 'done', className: 'ui wide', textContent: 'Done', hidden: true });
const addBtnEl = h('div', { id: 'addbtn', className: 'ui', textContent: '+', title: 'Add a button', hidden: true });
pad.append(lockBtn, fullBtn, gearBtn, eyeBtn, doneBtn, addBtnEl);
doc.body.append(pad);

const defs = new Map();                // id -> control (built-in, extra and driving parts)
const ctlEls = new Map();              // id -> element
const active = new Map();              // pointer id -> { c, el }: hold controls being pressed
const latched = new Set();             // lock-mode controls that are on
const dragPtr = new Map();             // pointer id -> last point, for a drag that turns the view (FIRE / AIM, any mode)

// placement: anchored to a side, so the layout keeps its place when the window changes size
function place(el, a) {
const side = flip(a.h);
el.style.left = el.style.right = el.style.top = el.style.bottom = '';
el.style[side] = a.x + 'vmin';
el.style[a.v] = a.y + 'vmin';
}
function placeAll() {
for (const c of defs.values()) place(ctlEls.get(c.id), settings.layout[c.id] || c.at);
place(stickEl, settings.stickAt || STICK_AT);
stickEl.hidden = !walkOn() || effDrive() === 'digital';
}
function applyVars() {
pad.style.setProperty('--bs', settings.buttonSize);
pad.style.setProperty('--ss', settings.stickSize);
pad.style.setProperty('--op', settings.opacity);
}

// the button list: built-in controls, then the walking keys or the driving controls (analog axis, or its digital buttons), then the extra keys
function allControls() {
const digital = effDrive() === 'digital';
const list = [...CONTROLS];
if (digital && walkOn()) for (const d of WASD_PARTS) list.push({ id: d.id, label: d.label, type: 'key', code: d.code, size: 'S', wasd: true, defMode: 'hold', at: WASD_AT[d.dir] });
for (const a of settings.ctlAxes) {
if (!digital) { list.push({ id: a.id, type: 'axis', custom: true, size: a.size || 'L', at: a.at }); continue; }
for (const p of axisParts(a)) {
list.push({
id: partId(a.id, p.pair, p.idx), label: p.label, type: 'key', part: { axis: a.id, pair: p.pair, idx: p.idx },
size: 'M', defMode: 'hold', at: { h: a.at.h, v: a.at.v, x: a.at.x + p.order * 13, y: a.at.y },
});
}
}
for (const k of settings.custom) list.push({ id: k.id, custom: true, type: 'key', code: k.key, size: 'M', defMode: k.mode, at: k.at });
return list;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const capOf = (c) => settings.btn[c.id]?.label || (c.wasd || c.part ? c.label : c.type === 'mouse' ? (c.bit === FIRE ? 'L' : 'R') : c.type === 'wheel' ? (c.step > 0 ? '\u25B2' : '\u25BC') : c.type === 'page' ? 'FPS' : comboName(c));
function paintLabel(c) {
const el = ctlEls.get(c.id);
if (!el) return;
if (c.type === 'axis') {
const a = axisOf(c.id);
if (a) { el.classList.add('axis'); el.innerHTML = AXIS_ICON[AXIS_ICON_BY_ID[a.id] || a.kind] + '<span class="cap">' + esc(settings.btn[c.id]?.label || a.name || AXIS_KIND[a.kind]) + '</span>'; }
paintTag(c);
return;
}
const custom = settings.btn[c.id]?.label;
if (settings.labelStyle === 'text') {
if (custom) el.textContent = custom;
else el.innerHTML = c.custom || mods(c).length || settings.keys[c.id] ? esc(comboName(c)) : c.label;
} else el.innerHTML = iconOf(c) + '<span class="cap">' + esc(capOf(c)) + '</span>';
paintTag(c);
}
function bindCtl(c, el) {
if (c.type === 'axis') return bindAxis(c, el);
el.addEventListener('pointerdown', (e) => {
if (editing) return drag(e, el, (canon) => { settings.layout[c.id] = canon; }, () => openButtonSheet(c));
e.preventDefault(); e.stopPropagation();
el.setPointerCapture(e.pointerId);
if (c.type === 'mouse') dragPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
if (c.type === 'wheel') {
Atomics.add(w, DZ, c.step);
el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 120);
buzz();
return;
}
if (modeOf(c) === 'tap') {
press(c, true); el.classList.add('on'); buzz();
setTimeout(() => { press(c, false); el.classList.remove('on'); }, 60);
return;
}
if (modeOf(c) === 'toggle') {
if (latched.delete(c.id)) { press(c, false); el.classList.remove('on'); }
else { latched.add(c.id); press(c, true); el.classList.add('on'); }
buzz();
return;
}
active.set(e.pointerId, { c, el });
el.classList.add('on');
press(c, true);
buzz();
});
const release = (e) => {
const a = active.get(e.pointerId);
if (!a) return;
active.delete(e.pointerId);
press(a.c, false);
a.el.classList.remove('on');
};
// a finger that holds FIRE / AIM can also slide and turn the view (one thumb shoots and aims)
el.addEventListener('pointermove', (e) => {
const a = dragPtr.get(e.pointerId);
if (!a || settings.dragLook === false) return;
turnView(e.clientX - a.x, e.clientY - a.y);
a.x = e.clientX; a.y = e.clientY;
});
const endPtr = (e) => { dragPtr.delete(e.pointerId); release(e); };
el.addEventListener('pointerup', endPtr);
el.addEventListener('pointercancel', endPtr);
el.addEventListener('lostpointercapture', endPtr);
}
function addCtl(c) {
defs.set(c.id, c);
const el = h('div', { className: 'ctl ' + (c.size === 'S' ? 'sq' : 'round') });
el.dataset.id = c.id;
ctlEls.set(c.id, el);
pad.insertBefore(el, lockBtn);
place(el, settings.layout[c.id] || c.at);
paintLabel(c);
styleCtl(c);
bindCtl(c, el);
}
// the arrow keys follow the eye button; UP stays on in the on-foot profile, the Gamepad profile always shows them
function arrowHidden(c) {
if (!ARROWS.includes(c.id) || profile === 'gamepad' || settings.showArrows) return false;
return !(c.id === 'phone' && profile === 'yaya');
}
// edit mode: a tag on each control showing how it works (HOLD, LOCK, TAP, ANALOG, ...)
function modeWord(c) {
if (c.type === 'axis') return 'ANALOG';
if (c.type === 'wheel') return 'STEP';
if (c.type === 'page') return 'ACTION';
const m = modeOf(c);
return m === 'toggle' ? 'LOCK' : m === 'tap' ? 'TAP' : 'HOLD';
}
function paintTag(c) {
const el = ctlEls.get(c.id);
if (!el) return;
let t = el.querySelector('.modetag');
if (!editing) { if (t) t.remove(); return; }
if (!t) { t = h('span', { className: 'modetag' }); el.append(t); }
t.textContent = modeWord(c);
}
// edit mode: controls that overlap each other are outlined in red
function paintClashes() {
const items = [...ctlEls.values(), stickEl].filter((el) => !el.hidden).map((el) => [el, el.getBoundingClientRect()]);
for (const [el] of items) el.classList.remove('clash');
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
const a = items[i][1], b = items[j][1];
if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
items[i][0].classList.add('clash'); items[j][0].classList.add('clash');
}
}
}
// size (the button's own scale on top of the global button size), opacity and shown / hidden, from the settings
function styleCtl(c) {
const el = ctlEls.get(c.id);
if (!el) return;
const b = settings.btn[c.id] || {};
el.dataset.size = c.size;
el.style.width = el.style.height = `calc(var(--bs, 1) * ${(SIZE[c.size] * (b.scale ?? 1)).toFixed(2)}vmin)`;
el.style.opacity = b.op !== undefined ? b.op : '';
const hide = !!b.hidden || arrowHidden(c);
if (hide && latched.has(c.id)) { latched.delete(c.id); press(c, false); el.classList.remove('on'); }   // a hidden lock is released, not left down
el.hidden = hide;
el.dataset.shape = b.shape || settings.shape || 'round';
paintTag(c);
}
function removeCtl(id) {
const el = ctlEls.get(id);
if (el) el.remove();
ctlEls.delete(id);
defs.delete(id);
}
function rebuildCtls() {
for (const id of [...ctlEls.keys()]) removeCtl(id);
defs.clear();
for (const c of allControls()) addCtl(c);
}
// the controls again after a change of mode, a walking control or a driving control
function refreshControls() {
releaseAll();
rebuildCtls();
placeAll();
if (editing) setTimeout(paintClashes, 0);
}

// ---- walking stick: W A S D while pushed past the dead zone (in a vehicle the same keys drive and steer) ----
const held = { up: false, down: false, left: false, right: false };
const setDir = (d, on) => { if (held[d] !== on) { held[d] = on; holdKey(WASD[d], on); } };
const stick = { id: null, cx: 0, cy: 0, radius: 1 };
function moveStick(e) {
let dx = e.clientX - stick.cx, dy = e.clientY - stick.cy;
const len = Math.hypot(dx, dy), max = stick.radius * 0.8;
if (len > max) { dx *= max / len; dy *= max / len; }
knob.style.transform = `translate(${dx}px, ${dy}px)`;
const dead = max * settings.stickDead;
setDir('left', dx < -dead); setDir('right', dx > dead);
setDir('up', dy < -dead); setDir('down', dy > dead);
}
function stickEnd(e) {
if (e && e.pointerId !== stick.id) return;
stick.id = null;
knob.style.transform = '';
knob.classList.remove('on');
for (const d of Object.keys(held)) setDir(d, false);
}
stickEl.addEventListener('pointerdown', (e) => {
if (editing) return drag(e, stickEl, (canon) => { settings.stickAt = canon; }, () => openStickSheet());
e.preventDefault(); e.stopPropagation();
if (stick.id !== null) return;          // one finger drives the stick; a second one is ignored
stickEl.setPointerCapture(e.pointerId);
stick.id = e.pointerId;
knob.classList.add('on');
const r = stickEl.getBoundingClientRect();
stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2;
stick.radius = STICK_RING * Math.min(innerWidth, innerHeight) / 100 * settings.stickSize;
moveStick(e);
});
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
stickEl.addEventListener('pointerup', stickEnd);
stickEl.addEventListener('pointercancel', stickEnd);
stickEl.addEventListener('lostpointercapture', stickEnd);

// view turning from any source (the look area, or a drag that started on a held button)
let lookId = null, lx = 0, ly = 0, rx = 0, ry = 0;
function turnView(dx, dy) {
const aim = btnRefs[1] > 0 ? settings.aimSens : 1;                              // AIM held: finer turning
const boost = 1 + settings.lookCurve * Math.min(Math.hypot(dx, dy) / 10, 3);    // fast swipes turn further
const k = LOOK_BASE * settings.lookSens * aim * boost * (devicePixelRatio || 1), sy = settings.invertY ? -1 : 1;
rx += dx * k; ry += dy * k * sy;
const ix = Math.trunc(rx), iy = Math.trunc(ry);
if (ix) { Atomics.add(w, DX, ix); rx -= ix; }
if (iy) { Atomics.add(w, DY, iy); ry -= iy; }
}
// any touch on the screen that is not a control turns the view; fractions are kept so slow drags add up
look.addEventListener('pointerdown', (e) => {
e.preventDefault();
if (lookId !== null) return;            // one finger turns the view; a second one does not take it over
lookId = e.pointerId; lx = e.clientX; ly = e.clientY; rx = ry = 0;
look.setPointerCapture(e.pointerId);
});
look.addEventListener('pointermove', (e) => {
if (e.pointerId !== lookId) return;
for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
turnView(ev.clientX - lx, ev.clientY - ly);
lx = ev.clientX; ly = ev.clientY;
}
});
const lookUp = (e) => { if (e.pointerId === lookId) lookId = null; };
look.addEventListener('pointerup', lookUp);
look.addEventListener('pointercancel', lookUp);
look.addEventListener('lostpointercapture', lookUp);

// ---- releasing everything: window lost focus, page hidden, panel or edit mode opened ----
function releaseAll() {
for (const a of active.values()) { press(a.c, false); a.el.classList.remove('on'); }
active.clear();
for (const id of latched) {
const c = defs.get(id);
if (c) press(c, false);
const el = ctlEls.get(id);
if (el) el.classList.remove('on');
}
latched.clear();
stickEnd(null);
lookId = null;
axisReleaseAll();
}
addEventListener('blur', releaseAll);
doc.addEventListener('visibilitychange', () => { if (doc.hidden) releaseAll(); });

// ---- layout editor: drag any control or the stick; the position is kept as a side and a distance in vmin ----
function drag(e, el, store, onTap) {
e.preventDefault(); e.stopPropagation();
el.setPointerCapture(e.pointerId);
const vm = Math.min(innerWidth, innerHeight) / 100;
const r = el.getBoundingClientRect();
const ox = e.clientX - r.left, oy = e.clientY - r.top;
const move = (ev) => {
const L = ev.clientX - ox, T = ev.clientY - oy;
const side = L + r.width / 2 < innerWidth / 2 ? 'left' : 'right';
const v = T + r.height / 2 < innerHeight / 2 ? 'top' : 'bottom';
const x = (side === 'left' ? L : innerWidth - L - r.width) / vm;
const y = (v === 'top' ? T : innerHeight - T - r.height) / vm;
const canon = { h: flip(side), x: clamp(Math.round(x), 0, 95), v, y: clamp(Math.round(y), 0, 95) };
place(el, canon);
store(canon);
paintClashes();
};
const dragEnds = ['pointerup', 'pointercancel', 'lostpointercapture'];
const up = (ev) => {
el.removeEventListener('pointermove', move);
for (const type of dragEnds) el.removeEventListener(type, up);
if (ev.type === 'lostpointercapture') return;
if (onTap && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 10) onTap();
};
el.addEventListener('pointermove', move);
for (const type of dragEnds) el.addEventListener(type, up);
}
const xClose = h('div', { id: 'tc-xclose', textContent: 'Close', title: 'Close edit mode', hidden: true });
doc.body.append(xClose);
function startEdit() {
closePanel();
pad.hidden=false;
releaseAll();
editSnap = JSON.stringify(settings);
editing = true;
pad.classList.add('editing');
doneBtn.hidden = false;
addBtnEl.hidden = false;
xClose.hidden = false;
if (!stickEl.querySelector('.modetag')) stickEl.append(h('span', { className: 'modetag', textContent: 'WASD' }));
setTimeout(paintClashes, 0);
for (const c of defs.values()) styleCtl(c);
}
// commit: the changes are saved. Otherwise the settings go back to what they were when the editor opened.
function endEdit(commit) {
if(settingsOnly)pad.hidden=true;
const snap = editSnap;
editing = false;
editSnap = null;
pad.classList.remove('editing');
doneBtn.hidden = true;
addBtnEl.hidden = true;
xClose.hidden = true;
stickEl.querySelector('.modetag')?.remove();
closeSheet();
if (commit) save();
else if (snap !== null) { settings = JSON.parse(snap); applyVars(); refreshControls(); paintEye(); }
for (const c of defs.values()) styleCtl(c);
}
// the close button asks first when a change was made and not saved
function requestExit() {
if (sig(settings) === sig(JSON.parse(editSnap))) return endEdit(false);
choiceBox('Layout changes were not saved. Save them?', [
{ label: 'Save', fn: () => endEdit(true) },
{ label: 'Discard', cls: 'danger', fn: () => endEdit(false) },
{ label: 'Cancel' },
]);
}
doneBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); endEdit(true); });
addBtnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (sheetEl) closeSheet(); else openAddSheet(); });
xClose.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); requestExit(); });

// ---- zoom lock (padlock) and full screen ----
// While the lock is closed, pinch and double-tap zoom do not reach the page. Closed by default on touch devices. Opened while the settings panel is up,
// so its sliders and lists can be scrolled.
let zoomLocked = true, panelOpen = false;
const zoomActive = () => !settingsOnly && controlsEnabled && zoomLocked && !panelOpen;
// blocks a pinch from starting at 100 %; once the page is zoomed in, pinching back out is always allowed
const pinchBlocked = () => zoomActive() && !(window.visualViewport && visualViewport.scale > 1.01);
function paintViewport() {
let m = doc.querySelector('meta[name="viewport"]');
if (!m) { m = h('meta', { name: 'viewport' }); doc.head.append(m); }
const base = 'width=device-width, initial-scale=1, viewport-fit=cover';
m.content = pinchBlocked() ? base + ', maximum-scale=1, minimum-scale=1, user-scalable=no' : base;
}
function paintZoom() {
const lock = zoomActive();
paintViewport();
doc.documentElement.style.touchAction = lock ? 'none' : '';
doc.body.style.touchAction = lock ? 'none' : '';
lockBtn.innerHTML = zoomLocked ? ICON.lockClosed : ICON.lockOpen;
lockBtn.title = zoomLocked ? 'Zoom locked (tap to unlock)' : 'Zoom unlocked (tap to lock)';
}
lockBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); zoomLocked = !zoomLocked; paintZoom(); });
// the eye: shows / hides the arrow keys in this profile
function paintEye() {
const on = settings.showArrows || profile === 'gamepad';
eyeBtn.hidden = profile === 'gamepad';   // the Gamepad profile always shows the arrow keys
eyeBtn.innerHTML = on ? ICON.eyeOn : ICON.eyeOff;
eyeBtn.title = on ? 'Hide arrow keys' : 'Show arrow keys';
}
eyeBtn.addEventListener('pointerdown', (e) => {
e.preventDefault();
settings.showArrows = !settings.showArrows;
save();
for (const id of ARROWS) if (defs.has(id)) styleCtl(defs.get(id));
paintEye();
});
addEventListener('touchstart', (e) => { if (pinchBlocked() && e.touches.length > 1) e.preventDefault(); }, { passive: false });
addEventListener('touchmove', (e) => { if (pinchBlocked() && e.touches.length > 1) e.preventDefault(); }, { passive: false });
addEventListener('gesturestart', (e) => { if (pinchBlocked()) e.preventDefault(); }, { passive: false });
if (window.visualViewport) {
visualViewport.addEventListener('resize', () => { if (visualViewport.scale !== 1) releaseAll(); paintViewport(); });
}   // iOS Safari pinch

const paintFull = () => {
const on = !!doc.fullscreenElement;
fullBtn.innerHTML = on ? ICON.exitFull : ICON.enterFull;
fullBtn.title = on ? 'Exit full screen' : 'Full screen';
};
if (!doc.fullscreenEnabled) fullBtn.style.display = 'none';
async function enterLandscape() {
try {
if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
if (screen.orientation?.lock) await screen.orientation.lock('landscape');
else if (innerHeight > innerWidth) rotateEl.textContent = 'Enable auto-rotate, then turn your phone sideways';
} catch (_) { rotateEl.textContent = 'Enable auto-rotate, then turn your phone sideways'; }
}
fullBtn.addEventListener('pointerdown', (e) => {
e.preventDefault();
if (doc.fullscreenElement) Promise.resolve(doc.exitFullscreen()).catch(() => {});
else enterLandscape();
});
doc.addEventListener('fullscreenchange', paintFull);

// ---- small controls shared by the panel and the sheets ----
const row = (label, control) => h('label', { className: 'row' }, h('span', { textContent: label }), control);
const slider = (label, value, min, max, step, onInput, fmt = (v) => (+v).toFixed(2)) => {
const out = h('span', { className: 'val' });
const input = h('input', { type: 'range' });
input.min = min; input.max = max; input.step = step; input.value = value;
const show = () => { out.textContent = fmt(input.value); };
input.addEventListener('input', () => { onInput(+input.value); show(); });
input.addEventListener('change', () => save());
show();
return h('label', { className: 'row' }, h('span', { textContent: label }), input, out);
};
const check = (label, checked, onChange) => {
const input = h('input', { type: 'checkbox', checked: !!checked });
input.addEventListener('change', () => { onChange(input.checked); save(); });
return row(label, input);
};
// our own choice buttons (no browser dropdown): the chosen one is highlighted
const select = (options, value, onChange) => {
const wrap = h('span', { className: 'chips' });
const paint = (cur) => { for (const b of wrap.children) b.classList.toggle('on', b.dataset.v === String(cur)); };
for (const [v, t] of options) {
const b = h('button', { type: 'button', textContent: t, onclick: (e) => { e.preventDefault(); paint(v); onChange(v); save(); } });
b.dataset.v = String(v);
wrap.append(b);
}
paint(value);
return wrap;
};
// a long list (keys) stays a dropdown; the first entry clears the key
const keyList = (options, value, onChange) => {
const s2 = h('select', {}, ...options.map(([v, t]) => h('option', { value: v, textContent: t })));
s2.value = value || '';
s2.addEventListener('change', () => { onChange(s2.value || null); save(); });
return s2;
};
const keySelectN = (value, onChange) => keyList([['', '— none —'], ...KEY_CHOICES.map((k) => [k, keyLabel(k)])], value, onChange);
const textRow = (label, value, placeholder, onChange) => {
const input = h('input', { type: 'text', value: value || '', placeholder, maxLength: 16 });
input.addEventListener('change', () => { onChange(input.value.trim()); save(); });
return row(label, input);
};
const modChips = (current, onChange) => {
const boxes = MODS.map((m) => [m, h('input', { type: 'checkbox', checked: current.includes(m) })]);
for (const [, cb] of boxes) cb.addEventListener('change', () => { onChange(boxes.filter(([, x]) => x.checked).map(([m]) => m)); save(); });
return h('span', { className: 'parts' }, ...boxes.map(([m, cb]) => h('label', { className: 'chip' }, cb, doc.createTextNode(keyLabel(m)))));
};
const anchorOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function placeAway(el, [ax, ay]) {
if (innerWidth >= innerHeight) el.classList.add(ax > innerWidth / 2 ? 'side-left' : 'side-right');
else el.classList.add(ay > innerHeight / 2 ? 'top-half' : 'bottom-half');
}
function shapeRow(b, c) {
return row('Shape', select([['', 'Same as all buttons'], ['round', 'Round'], ['rounded', 'Rounded square'], ['square', 'Square']], b.shape || '', (v) => {
b.shape = v || undefined; styleCtl(c);
}));
}
// our own message box (replaces the browser's confirm / alert): each button runs its action and closes the box
function choiceBox(message, buttons) {
const box = h('div', { id: 'tc-box', className: 'tc-ui' }, h('p', { textContent: message }));
box.append(h('div', { className: 'stack' }, ...buttons.map((b) => h('button', {
className: b.cls || '', textContent: b.label,
onclick: () => { box.remove(); if (b.fn) b.fn(); },
}))));
doc.body.append(box);
}
const askBox = (message, okLabel, onOk) => choiceBox(message, onOk
? [{ label: okLabel, cls: 'danger', fn: onOk }, { label: 'Cancel' }]
: [{ label: okLabel }]);

// ---- buttons: their settings (a tap on a control in the layout editor) ----
// where a control sits: side, edge, and exact distances in vmin
function positionNodes(c) {
const cur = () => ({ ...(settings.layout[c.id] || c.at) });
const put = (patch) => { settings.layout[c.id] = { ...cur(), ...patch }; place(ctlEls.get(c.id), settings.layout[c.id]); paintClashes(); };
const p = cur();
return [
row('Side', select([['left', 'Left'], ['right', 'Right']], flip(p.h), (v) => put({ h: flip(v) }))),
row('Edge', select([['bottom', 'Bottom'], ['top', 'Top']], p.v, (v) => put({ v }))),
slider('Distance from side', p.x, 0, 95, 0.5, (v) => put({ x: v }), (v) => (+v).toFixed(1) + ' vmin'),
slider('Distance from edge', p.y, 0, 95, 0.5, (v) => put({ y: v }), (v) => (+v).toFixed(1) + ' vmin'),
];
}
function buttonNodes(c, done) {
const b = settings.btn[c.id] || (settings.btn[c.id] = {});
const nameOf = () => b.label || b.name || (c.type === 'key' && (c.custom || c.wasd || mods(c).length || settings.keys[c.id]) ? comboName(c) : c.label.replace('<br>', ' '));
const title = h('h2', { textContent: nameOf() });
const modeNote = h('p', { className: 'note', textContent: KEY_NOTE[modeOf(c)] || '' });
const nodes = [...(editing ? [title] : []),
slider('Size', b.scale ?? 1, 0.5, 2, 0.01, (v) => { b.scale = v; styleCtl(c); }, (v) => (+v).toFixed(2) + '×'),
slider('Opacity', b.op ?? settings.opacity, 0.2, 1, 0.01, (v) => { b.op = v; styleCtl(c); }),
check('Shown', !b.hidden, (on) => { b.hidden = !on; styleCtl(c); }), shapeRow(b, c)];
nodes.push(textRow('Caption', b.label, 'default', (v) => { b.label = v; title.textContent = nameOf(); paintLabel(c); }));
if (c.type === 'key') {
nodes.push(row('Key', keySelectN(keyOf(c), (v) => { setKeyOf(c, v); paintLabel(c); title.textContent = nameOf(); })));
nodes.push(row('Hold with', modChips(b.mods || [], (list) => { b.mods = list; paintLabel(c); title.textContent = nameOf(); })));
}
if (!c.noToggle && (c.type === 'key' || c.type === 'mouse')) {
nodes.push(row('Mode', select([['hold', 'Hold'], ['toggle', 'Lock'], ['tap', 'Tap']], modeOf(c), (v) => {
settings.modes[c.id] = v;
modeNote.textContent = KEY_NOTE[v] || '';
styleCtl(c);
if (v !== 'toggle' && latched.delete(c.id)) { press(c, false); ctlEls.get(c.id)?.classList.remove('on'); }
})));
nodes.push(modeNote);
}
if (editing) nodes.push(...positionNodes(c));
nodes.push(h('div', { className: 'actions' }, c.custom
? h('button', { textContent: 'Delete button', onclick: () => { removeCustom(c.id); done && done(); } })
: h('button', { textContent: 'Reset button', onclick: () => { resetCtl(c); done && done(); } })));
return nodes;
}
const KEY_NOTE = {
hold: 'The key works as long as you hold the button.',
toggle: 'Tap once: the key stays on. Tap again: it turns off.',
tap: 'Each tap presses the key once.',
};
// the analog control of a driving axis (only in Analog mode; in Digital mode its buttons are edited instead)
function axisNodes(c, done) {
const a = axisOf(c.id);
const b = settings.btn[c.id] || (settings.btn[c.id] = {});
const title = h('h2', { textContent: a.name || AXIS_KIND[a.kind] });
const nodes = [...(editing ? [title] : []),
slider('Size', b.scale ?? 1, 0.5, 2, 0.01, (v) => { b.scale = v; styleCtl(c); }, (v) => (+v).toFixed(2) + '×'),
slider('Opacity', b.op ?? settings.opacity, 0.2, 1, 0.01, (v) => { b.op = v; styleCtl(c); }),
check('Shown', !b.hidden, (on) => { b.hidden = !on; styleCtl(c); }), shapeRow(b, c),
textRow('Name', a.name, AXIS_KIND[a.kind], (v) => { a.name = v; title.textContent = v || AXIS_KIND[a.kind]; paintLabel(c); }),
row('Kind', select(Object.entries(AXIS_KIND), a.kind, (v) => {
setKindDefaults(a, v);
refreshControls();
closeSheet();
openButtonSheet(c);
})),
h('p', { className: 'note', textContent: AXIS_NOTE[a.kind] || '' }),
];
const labels = AXIS_KEY_LABELS[a.kind] || {};
if (labels.x) {
a.kx = a.kx || [null, null];
nodes.push(row(labels.x[1].replace(' key', ''), keySelectN(a.kx[1], (v) => { a.kx[1] = v; })));
nodes.push(row(labels.x[0].replace(' key', ''), keySelectN(a.kx[0], (v) => { a.kx[0] = v; })));
}
if (labels.y) {
a.ky = a.ky || [null, null];
nodes.push(row(labels.y[1].replace(' key', ''), keySelectN(a.ky[1], (v) => { a.ky[1] = v; })));
nodes.push(row(labels.y[0].replace(' key', ''), keySelectN(a.ky[0], (v) => { a.ky[0] = v; })));
}
nodes.push(slider('Response time', a.ramp ?? 0.3, 0.02, 1.5, 0.02, (v) => { a.ramp = v; }, (v) => (+v).toFixed(2) + ' s'));
nodes.push(slider('Sensitivity', (a.sens ?? 1) * 3, 1, 5, 0.01, (v) => { a.sens = v / 3; }, (v) => (+v).toFixed(2)));
nodes.push(slider('Dead zone', a.dead ?? 0.06, 0, 0.4, 0.01, (v) => { a.dead = v; }));
if (editing) nodes.push(...positionNodes(c));
nodes.push(h('div', { className: 'actions' }, h('button', { textContent: 'Delete control', onclick: () => { removeAxis(c.id); done && done(); } })));
return nodes;
}
function setKindDefaults(a, kind) {
a.kind = kind;
a.kx = kind === 'wheel' ? ['KeyA', 'KeyD'] : kind === 'yoke' ? ['Numpad4', 'Numpad6'] : null;
a.ky = kind === 'pedal' || kind === 'lever' ? ['KeyS', 'KeyW'] : kind === 'yoke' ? ['Numpad8', 'Numpad5'] : null;
a.ramp = kind === 'wheel' ? 0.15 : 0.45;
}

// ---- sheets: one control (a tap in the layout editor) and the command prompt (+) ----
let sheetEl = null;
function closeSheet() { if (sheetEl) sheetEl.remove(); sheetEl = null; }
// the walking stick: size and dead zone, opened by tapping it in the layout editor
function openStickSheet() {
closeSheet();
releaseAll();
sheetEl = h('div', { id: 'tc-sheet', className: 'tc-ui' });
placeAway(sheetEl, anchorOf(stickEl));
sheetEl.append(h('div', { className: 'head' }, h('span', { className: 'sheet-tag', textContent: 'Walking stick (WASD)' }),
h('button', { textContent: 'Close', onclick: () => closeSheet() })));
sheetEl.append(h('p', { className: 'note', textContent: 'W A S D keys. Drag it to move it. Size and dead zone are set here.' }));
sheetEl.append(slider('Size', settings.stickSize, 0.6, 1.6, 0.01, (v) => { settings.stickSize = v; applyVars(); }, (v) => (+v).toFixed(2) + '×'));
sheetEl.append(slider('Dead zone', settings.stickDead, 0, 0.6, 0.05, (v) => { settings.stickDead = v; }));
doc.body.append(sheetEl);
}
function openButtonSheet(c) {
closeSheet();
releaseAll();
sheetEl = h('div', { id: 'tc-sheet', className: 'tc-ui' });
placeAway(sheetEl, anchorOf(ctlEls.get(c.id)));
sheetEl.append(h('div', { className: 'head' }, h('span', { className: 'sheet-tag', textContent: c.type === 'axis' ? 'Driving control' : 'Button' }),
h('button', { textContent: 'Close', onclick: () => closeSheet() })));
for (const n of (c.type === 'axis' ? axisNodes(c, closeSheet) : buttonNodes(c, closeSheet))) sheetEl.append(n);
doc.body.append(sheetEl);
}
// one line. A button: button=name;label=caption;key=KeyCode;action=hold|lock|tap;mods=ControlLeft,ShiftLeft,AltLeft;size=0.5-2
// A driving control: kind=wheel|pedal|lever;button=name;key=KeyD;key2=KeyA;ramp=0.3
function parseCommand(text) {
const f = {};
for (const part of text.split(';')) {
const i = part.indexOf('=');
if (i > 0) f[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
}
if (f.kind) {
const kind = f.kind.toLowerCase();
if (!['wheel', 'pedal', 'lever'].includes(kind)) return { error: 'kind must be wheel, pedal or lever (the yoke comes with the aircraft profiles).' };
if (!f.key || !VK[f.key]) return { error: 'key= is the forward or right key (for example key=KeyW).' };
if (f.key2 && !VK[f.key2]) return { error: 'Unknown key2 "' + f.key2 + '".' };
return { axis: { kind, name: f.button || '', pos: f.key, neg: f.key2 || null, ramp: f.ramp ? +f.ramp : undefined } };
}
if (!f.key) return { error: 'key= is missing (for example key=KeyQ).' };
if (!VK[f.key]) return { error: 'Unknown key "' + f.key + '". Use a key code such as KeyQ, Space, ArrowLeft or ControlLeft.' };
const action = (f.action || 'hold').toLowerCase();
if (!['hold', 'lock', 'tap'].includes(action)) return { error: 'action must be hold, lock or tap.' };
const modList = (f.mods || '').split(',').map((m) => m.trim()).filter(Boolean);
if (modList.some((m) => !MODS.includes(m))) return { error: 'mods can only be ControlLeft, ShiftLeft or AltLeft.' };
const scale = f.size ? +f.size : 1;
if (!(scale >= 0.5 && scale <= 2)) return { error: 'size must be between 0.5 and 2.' };
return { value: { name: f.button || '', label: f.label || '', key: f.key, mode: action === 'lock' ? 'toggle' : action, mods: modList, scale } };
}
function openAddSheet() {
closeSheet(); closePanel(); releaseAll();
const hiddenNow = [...defs.values()].filter((c) => settings.btn[c.id]?.hidden && !ARROWS.includes(c.id));
const showList = h('div', { className: 'chips' }, ...hiddenNow.map((c) => h('button', { type: 'button', textContent: String(settings.btn[c.id].label || settings.btn[c.id].name || c.label || c.id).replace('<br>', ' '), onclick: () => { settings.btn[c.id].hidden = false; styleCtl(c); save(); openAddSheet(); } })));
if (settings.stickOn === false) showList.append(h('button', { type: 'button', textContent: 'Walking stick', onclick: () => { settings.stickOn = true; refreshControls(); save(); openAddSheet(); } }));
const cmd = h('input', { type: 'text', value: 'button=;label=;key=;action=hold', className: 'cmd', spellcheck: false, autocapitalize: 'off' });
const msg = h('p', { className: 'note' });
const prompt = h('textarea', { readOnly: true, rows: 9, className: 'prompt', value: BASE_PROMPT });
const copy = h('button', { textContent: 'Copy the prompt', onclick: () => {
let ok = false;
try { prompt.select(); ok = doc.execCommand('copy'); } catch (e) { ok = false; }
msg.textContent = ok ? 'Copied.' : 'Select the text above and copy it.';
} });
const add = h('button', { textContent: 'Add', onclick: () => {
const r = parseCommand(cmd.value);
if (r.error) { msg.textContent = r.error; return; }
if (r.axis) addAxis(r.axis); else addCustom(r.value);
closeSheet();
} });
sheetEl = h('div', { id: 'tc-sheet', className: 'tc-ui' });
placeAway(sheetEl, anchorOf(addBtnEl));
sheetEl.append(
h('div', { className: 'head' }, h('span', { className: 'sheet-tag', textContent: 'New control' }), h('button', { textContent: 'Close', onclick: () => closeSheet() })),
h('p', { className: 'note', textContent: hiddenNow.length || settings.stickOn === false ? 'Hidden buttons (tap to show again):' : 'No hidden buttons.' }),
showList,
h('p', { className: 'note', textContent: 'Prompt for an AI assistant (copy it, add your request, and paste back the one-line answer):' }),
prompt, copy,
h('p', { className: 'note', textContent: 'Command:' }),
cmd, msg,
h('div', { className: 'actions' }, add));
doc.body.append(sheetEl);
}

// ---- buttons: add, remove, reset ----
function addCustom(o) {
const id = 'k' + Date.now().toString(36);
settings.custom.push({ id, key: o.key, mode: o.mode, at: { h: 'right', x: 50, v: 'top', y: 13 } });
settings.btn[id] = { name: o.name || '', label: o.label || '', mods: o.mods || [], scale: o.scale ?? 1 };
save();
refreshControls();
if (panelEl) openPanel();
}
function removeCustom(id) {
releaseAll();
settings.custom = settings.custom.filter((k) => k.id !== id);
for (const m of [settings.layout, settings.keys, settings.modes, settings.btn]) delete m[id];
removeCtl(id);
save();
if (panelEl) openPanel();
}
// a built-in button back to the set of this profile: position, key, mode, size, opacity, caption and shown
function resetCtl(c) {
const p = presetFor(profile);
for (const m of [settings.layout, settings.keys, settings.modes, settings.btn]) delete m[c.id];
if (p.layout[c.id]) settings.layout[c.id] = clone(p.layout[c.id]);
if (p.modes[c.id]) settings.modes[c.id] = p.modes[c.id];
if (p.btn[c.id]) settings.btn[c.id] = clone(p.btn[c.id]);
save();
refreshControls();
if (panelEl) openPanel();
}
function addAxis(o) {
const id = 'a' + Date.now().toString(36);
const a = { id, kind: o.kind, kx: null, ky: null, ramp: o.ramp ?? (o.kind === 'wheel' ? 0.15 : 0.45), sens: 1, dead: 0.06, size: 'L', at: { h: 'right', x: 50, v: 'top', y: 13 }, name: o.name || '' };
// the command gives the forward / right key (pos) and the back / left key (neg)
if (o.kind === 'wheel') a.kx = [o.neg, o.pos]; else a.ky = [o.neg, o.pos];
settings.ctlAxes.push(a);
settings.btn[id] = { name: o.name || '', label: '', scale: 1 };
save();
refreshControls();
if (panelEl) openPanel();
}
function removeAxis(id) {
const st = axisRun.get(id);
if (st) { setAxisKey(st, 'x', null, false); setAxisKey(st, 'y', null, false); axisRun.delete(id); }
settings.ctlAxes = settings.ctlAxes.filter((a) => a.id !== id);
for (const m of [settings.layout, settings.btn]) for (const k of Object.keys(m)) if (k === id || k.startsWith(id + '#')) delete m[k];
refreshControls();
save();
if (panelEl) openPanel();
}

// ---- driving controls. Analog: the axis is one control. Digital: its keys are buttons (see allControls), so every key is a plain press.
// Analog amounts reach the game as key pulses: a pulse is PWM_MS long and the key is down for the share that matches the amount (at least PWM_MIN_MS).
// The game reads the keys once per frame, so a pulse shorter than a frame is lost; the minimum on-time keeps low amounts visible.
const PWM_MS = 120, PWM_MIN_MS = 30;
const axisRun = new Map();              // id -> run state of a driving control
function axisState(id) {
let st = axisRun.get(id);
if (!st) {
st = { t: { x: 0, y: 0 }, m: { x: 0, y: 0 }, dir: { x: 1, y: 1 }, applied: { x: { vk: 0, on: false }, y: { vk: 0, on: false } }, pointer: null, el: null, aim: null, last: performance.now(), wa: 0, lastAng: null };
axisRun.set(id, st);
}
return st;
}
function setAxisKey(st, name, code, on) {
const vk = code && VK[code] ? VK[code] : 0;
const want = !!vk && !!on;
const cur = st.applied[name];
if (cur.vk === vk && cur.on === want) return;
if (cur.vk && cur.on) holdKey(cur.vk, false);
if (want) holdKey(vk, true);
st.applied[name] = { vk, on: want };
}
const pwmOn = (now, level) => level >= 0.02 && (now % PWM_MS) < Math.max(PWM_MIN_MS, level * PWM_MS);
function axisTick(now) {
for (const [id, st] of axisRun) {
const a = axisOf(id);
if (!a) { setAxisKey(st, 'x', null, false); setAxisKey(st, 'y', null, false); axisRun.delete(id); continue; }
const dt = Math.min(0.1, (now - st.last) / 1000);
st.last = now;
const ramp = Math.max(0.02, a.ramp ?? 0.3);
for (const name of ['x', 'y']) {
const goal = st.t[name], want = Math.abs(goal), m = st.m[name];
// up moves over the response time, back to zero a little slower
st.m[name] = m < want ? Math.min(want, m + dt / ramp) : Math.max(want, m - dt / (ramp * 0.6));
if (goal) st.dir[name] = Math.sign(goal);
const pair = name === 'x' ? a.kx : a.ky;
const code = pair ? pair[st.dir[name] > 0 ? 1 : 0] : null;
setAxisKey(st, name, code, !!code && pwmOn(now, st.m[name]));
}
if (a.kind === 'wheel' && st.pointer === null && st.wa !== 0) {   // released: the wheel springs back to centre
const step = dt * WHEEL_LOCK / Math.max(0.05, ramp * 0.6);
st.wa = Math.abs(st.wa) <= step ? 0 : st.wa - Math.sign(st.wa) * step;
}
if (st.el) {
if (a.kind === 'wheel') st.el.style.setProperty('--wa', (st.wa * 180 / Math.PI).toFixed(1) + 'deg');
st.el.style.setProperty('--x', st.m.x * st.dir.x);
st.el.style.setProperty('--y', st.m.y * st.dir.y);
st.el.style.setProperty('--lvl', st.m.y);
			const along = st.m.y > 0.01 ? st.dir.y : 0;          // the progress bar: forward (light blue) or back (orange)
			st.el.classList.toggle('fwd', along > 0);
			st.el.classList.toggle('back', along < 0);
}
}
}
(function frame(now) { axisTick(now); requestAnimationFrame(frame); })(performance.now());
// A steering wheel turns with the finger's turn around its centre, like a real wheel: it follows the movement, so it works from any point
// on the wheel and goes round a full 360 degrees (it stops at 270 degrees to each side). Sensitivity is the turn ratio (1 = the wheel turns as far as the finger).
const WHEEL_LOCK = 1.5 * Math.PI;
function wheelFollow(st, a, el, e) {
const r = el.getBoundingClientRect();
const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
if (Math.hypot((e.clientX - cx) / (r.width / 2), (cy - e.clientY) / (r.height / 2)) < 0.2) { st.lastAng = null; return; }   // the middle does not turn it
const ang = Math.atan2(e.clientX - cx, cy - e.clientY);                  // straight up = 0, clockwise positive
if (st.lastAng !== null) {
const d = Math.atan2(Math.sin(ang - st.lastAng), Math.cos(ang - st.lastAng));   // the short way round
st.wa = clamp(st.wa + d * (a.sens ?? 1), -WHEEL_LOCK, WHEEL_LOCK);
}
st.lastAng = ang;
const dead = a.dead ?? 0.06, v = Math.abs(st.wa) / WHEEL_LOCK;
const x = v < dead ? 0 : Math.sign(st.wa) * (v - dead) / (1 - dead);
applyAxisTarget(st, { x, y: 0 });
}
// where a finger is on an analog control, as a target from -1 to 1 for each of its two directions
function axisAim(a, el, e) {
const r = el.getBoundingClientRect();
const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
const dx = (e.clientX - cx) / (r.width / 2);
const dy = (cy - e.clientY) / (r.height / 2);
const sens = a.sens ?? 1, dead = a.dead ?? 0.06;
const shape = (v) => { const av = Math.min(1, Math.abs(v) * sens); return av < dead ? 0 : Math.sign(v) * (av - dead) / (1 - dead); };
return { x: a.kind === 'yoke' ? shape(dx) : 0, y: shape(dy) };
}
function applyAxisTarget(st, t) { st.t.x = t.x; st.t.y = t.y; if (t.x) st.dir.x = Math.sign(t.x); if (t.y) st.dir.y = Math.sign(t.y); }
function axisDown(c, el, e) {
const a = axisOf(c.id);
if (!a) return;
const st = axisState(c.id);
st.el = el; st.aim = a;
el.setPointerCapture(e.pointerId);
buzz();
st.pointer = e.pointerId;
if (a.kind === 'wheel') { st.lastAng = null; wheelFollow(st, a, el, e); }
else applyAxisTarget(st, axisAim(a, el, e));
}
function axisMove(c, el, e) {
const st = axisRun.get(c.id);
if (!st || st.pointer !== e.pointerId || !st.aim) return;
if (st.aim.kind === 'wheel') wheelFollow(st, st.aim, el, e);
else applyAxisTarget(st, axisAim(st.aim, el, e));
}
function axisUp(c, e) {
const st = axisRun.get(c.id);
if (!st || st.pointer !== e.pointerId) return;
st.pointer = null;
st.lastAng = null;
st.t.x = 0; st.t.y = 0;
}
function axisReleaseAll() {
for (const st of axisRun.values()) {
st.pointer = null; st.wa = 0; st.lastAng = null;
st.t = { x: 0, y: 0 }; st.m = { x: 0, y: 0 };
setAxisKey(st, 'x', null, false); setAxisKey(st, 'y', null, false);
}
}
function bindAxis(c, el) {
el.addEventListener('pointerdown', (e) => {
if (editing) return drag(e, el, (canon) => { settings.layout[c.id] = canon; }, () => openButtonSheet(c));
e.preventDefault(); e.stopPropagation();
axisDown(c, el, e);
});
el.addEventListener('pointermove', (e) => axisMove(c, el, e));
const up = (e) => axisUp(c, e);
el.addEventListener('pointerup', up);
el.addEventListener('pointercancel', up);
el.addEventListener('lostpointercapture', up);
}

// ---- backup: all profiles in one file (move to another phone or browser, or restore) ----
async function profileNow(id) {
if (id === profile) return settings;
return (await fetchProfile(id)).s;
}
async function exportAll() {
const out = { app: 'gta5-touch', version: AXIS_VERSION, profiles: {} };
for (const p of PROFILES) out.profiles[p.id] = await profileNow(p.id);
const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
const a = h('a', { href: url, download: 'gta5-touch-settings.json' });
doc.body.append(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function pickImport() {
const f = h('input', { type: 'file', accept: '.json,application/json' });
f.addEventListener('change', () => { if (f.files[0]) importAll(f.files[0]); });
f.click();
}
// a file from another device: each profile is checked and repaired where possible; what cannot be kept is set to its default
function importAll(file) {
const reader = new FileReader();
reader.onload = () => {
let data;
try { data = JSON.parse(reader.result); } catch (e) { askBox('This file is not valid JSON.', 'OK'); return; }
const list = plainObj(plainObj(data).profiles);
let n = 0;
for (const p of PROFILES) {
const raw = list[p.id];
if (!raw || typeof raw !== 'object') continue;
const s2 = repairAxes(sanitize(raw), p.id);
s2.savedAt = Date.now();
n++;
if (p.id === profile) settings = s2;
try { localStorage.setItem(localKey(p.id), JSON.stringify(s2)); } catch (e) { /* blocked */ }
post('api/settings?kind=user&profile=' + p.id, JSON.stringify(s2));
}
if (!n) { askBox('No profile settings found in this file.', 'OK'); return; }
applyAll();
openPanel();
askBox(n + ' profile(s) imported.', 'OK');
};
reader.readAsText(file);
}

// ---- switching profiles: a clean state first (no key or mouse button stays down from the profile before) ----
const applyAll = () => {
releaseAll();
keyRefs.fill(0); keys.fill(0); btnRefs.fill(0); Atomics.and(w, BTN, 0);
applyVars(); refreshControls(); paintEye(); save();
};
let switchSeq = 0;
async function switchProfile(id) {
const seq = ++switchSeq;
if (id === profile) return;
const { s } = await fetchProfile(id);
if (seq !== switchSeq) return;
profile = id;
try { localStorage.setItem(PROFILE_KEY, id); } catch (e) { /* blocked: the choice lasts for this visit */ }
settings = s;
applyAll();
openPanel();
}

// ---- settings panel ----
let panelEl = null;
function closePanel() {
if (panelEl) panelEl.remove();
panelEl = null;
panelOpen = false;
if(settingsOnly&&!editing)pad.hidden=true;
paintZoom();
}
function openPanel() {
closePanel(); closeSheet(); releaseAll();
panelOpen = true;
paintZoom();

const panel = h('div', { id: 'tc-panel', className: 'tc-ui' });
panel.append(h('div', { className: 'head' }, h('h2', { textContent: 'Touch controls' }), h('button', { textContent: 'Close', onclick: () => closePanel() })));

panel.append(h('h3', { textContent: 'Profile' }));
const pickBtn = h('button', { type: 'button', className: 'pick', textContent: (PROFILES.find((p) => p.id === profile) || {}).name + '  \u25BE' });
const pickList = h('div', { className: 'pick-list', hidden: true }, ...PROFILES.map((p) => h('button', {
type: 'button', className: p.id === profile ? 'on' : '', textContent: p.name,
onclick: () => { pickList.hidden = true; if (p.id !== profile) switchProfile(p.id); },
})));
pickBtn.addEventListener('click', () => { pickList.hidden = !pickList.hidden; });
panel.append(h('div', { className: 'picker' }, pickBtn, pickList));
panel.append(h('p', { className: 'note', textContent: 'Each profile keeps its own changes. Reset profile returns the open one to its set.' }));
if (profile !== 'yaya') panel.append(check('Walking control (stick, or W A S D buttons in Digital mode)', settings.stickOn !== false, (on) => { settings.stickOn = on; refreshControls(); }));

if (profile !== 'gamepad') {
panel.append(h('h3', { textContent: 'Movement and driving' }));
panel.append(row('Mode', select([['analog', 'Analog'], ['digital', 'Digital']], settings.drive, (v) => {
settings.drive = v;
refreshControls();
})));
panel.append(h('p', { className: 'note', textContent: 'Analog: the stick and each driving control are one control. Digital: every direction is its own button (W A S D on foot; LEFT / RIGHT, GAS / BRAKE, THR -/+ in vehicles). One choice changes all of them.' }));
}

panel.append(h('h3', { textContent: 'Screen' }));
panel.append(row('Button labels', select([['icon', 'Icons'], ['text', 'Text']], settings.labelStyle, (v) => {
settings.labelStyle = v;
for (const c of defs.values()) paintLabel(c);
})));
panel.append(slider('All buttons: size', settings.buttonSize, 0.6, 1.6, 0.01, (v) => { settings.buttonSize = v; applyVars(); }));
panel.append(slider('All buttons: opacity', settings.opacity, 0.2, 1, 0.01, (v) => { settings.opacity = v; applyVars(); for (const c of defs.values()) styleCtl(c); }));
panel.append(row('All buttons: shape', select([['round', 'Round'], ['rounded', 'Rounded square'], ['square', 'Square']], settings.shape || 'round', (v) => { settings.shape = v; for (const c of defs.values()) styleCtl(c); })));
panel.append(check('Left-handed layout', settings.leftHanded, (on) => { settings.leftHanded = on; placeAll(); }));
panel.append(check('Vibrate on press', settings.haptics, (on) => { settings.haptics = on; }));

panel.append(h('h3', { textContent: 'Look' }));
panel.append(slider('Look sensitivity', lookShown(settings.lookSens), 1, 5, 0.01, (v) => { settings.lookSens = lookFromShown(v); }, (v) => (+v).toFixed(2)));
panel.append(check('Invert vertical look', settings.invertY, (on) => { settings.invertY = on; }));
panel.append(slider('Aim sensitivity (while AIM is held)', settings.aimSens * 6, 1, 5, 0.01, (v) => { settings.aimSens = v / 6; }, (v) => (+v).toFixed(2)));
panel.append(slider('Fast-turn boost (quick swipes turn further)', settings.lookCurve, 0, 1, 0.05, (v) => { settings.lookCurve = v; }));
panel.append(check('Dragging a held FIRE / AIM also turns the view', settings.dragLook !== false, (on) => { settings.dragLook = on; }));

panel.append(h('h3', { textContent: 'Layout and backup' }));
panel.append(h('div', { className: 'stack' },
h('button', { textContent: 'Edit layout', onclick: () => startEdit() }),
h('button', { textContent: 'Export all profiles', onclick: () => exportAll() }),
h('button', { textContent: 'Import profiles', onclick: () => pickImport() })));
panel.append(h('h3', { textContent: 'Delete', className: 'danger-h' }));
panel.append(h('div', { className: 'stack' },
h('button', { className: 'danger', textContent: 'Reset layout', onclick: () => askBox('Put every control of this profile back to its set position?', 'Reset layout', () => resetLayout()) }),
h('button', { className: 'danger', textContent: 'Reset profile', onclick: () => askBox('Return this profile to its factory set?', 'Reset profile', () => { releaseAll(); settings = factoryOf(profile); applyAll(); openPanel(); }) })));

// Each section (a heading and the rows under it) becomes a card; the action buttons stay outside
let card = null;
for (const el of [...panel.children]) {
if (el.classList.contains('head')) continue;
if (el.classList.contains('actions')) { card = null; continue; }
if (el.tagName === 'H3') { card = h('section', { className: 'card' }); panel.insertBefore(card, el); }
if (card) card.append(el);
}
placeAway(panel, anchorOf(gearBtn));
doc.body.append(panel);
panelEl = panel;
}
function resetLayout() {
const f = factoryOf(profile);
settings.layout = clone(f.layout);
settings.stickAt = clone(f.stickAt);
save();
refreshControls();
openPanel();
}
gearBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (editing) requestExit(); openPanel(); });

// portrait hint: the game is played in landscape
const rotateEl = h('button', { id: 'tc-rotate', type: 'button', textContent: 'Tap for landscape / full screen', hidden: true });
rotateEl.addEventListener('click', enterLandscape);
doc.body.append(rotateEl);
const paintRotate = () => { rotateEl.hidden = settingsOnly || !controlsEnabled || innerHeight <= innerWidth; };
addEventListener('resize', paintRotate);
paintRotate();

// ---- start ----
applyVars();
refreshControls();
paintZoom();
paintFull();
paintEye();
return { openPanel, startEdit, releaseAll,
isSettingsOpen: () => editing || panelOpen || !!sheetEl,
applyBundle(bundle) {if(editing)endEdit(false);profile=bundle.activeProfile;settings=bundle.profiles[profile];applyAll();if(panelEl)openPanel();},
setEnabled(on) { controlsEnabled=on;paintZoom();if (!on) { if (editing) endEdit(false); closePanel(); closeSheet(); releaseAll(); } pad.hidden = !on; rotateEl.hidden = settingsOnly || !on || innerHeight <= innerWidth; }
};
}

export function normaliseTouchBundle(raw,VK){
 VKEYS=VK;
 if(!raw||raw.app!=='gta5-touch'||!Number.isInteger(raw.version)||raw.version<1||raw.version>AXIS_VERSION)throw Error('Unsupported touch.js settings');
 const profiles={};for(const p of PROFILES){const value=plainObj(raw.profiles)[p.id];profiles[p.id]=repairAxes(value?sanitize(value):factoryOf(p.id),p.id);}
 return {app:'gta5-touch',version:AXIS_VERSION,profiles,activeProfile:PROFILES.some(p=>p.id===raw.activeProfile)?raw.activeProfile:'yaya',mode:['auto','on','off'].includes(raw.mode)?raw.mode:'auto'};
}
// Preserve settings from the separately tested reference trial without overwriting either namespace.
try {for(const p of PROFILES){if(!localStorage.getItem(localKey(p.id))){const old=localStorage.getItem('gta5-touch-reference-trial-v1:'+p.id);if(old)localStorage.setItem(localKey(p.id),old);}}if(!localStorage.getItem(PROFILE_KEY)){const old=localStorage.getItem('gta5-touch-reference-trial-profile');if(old)localStorage.setItem(PROFILE_KEY,old);}}catch(_){}

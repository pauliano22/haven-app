// ── Tinnitus ("Match your sound") band preset ────────────────────────────────
//
// The published notched-sound work for tonal tinnitus (Okamoto et al. 2010;
// the Stein et al. 2016 trial) removes roughly ONE OCTAVE centred on the
// matched pitch — not the narrow Q = 10 notch that suits an alarm or a motor
// whine. In RBJ terms a one-octave bandwidth is Q ≈ 1.41 (Q = 1 / (2·sinh(ln2/2·BW))).
// So when a pitch-match result is applied, the band defaults to this width,
// and the user can still choose the narrow one. The LDL flow keeps
// Q_DEFAULT: there the target is a specific external sound, not a percept.
// Rationale and evidence: the project's clinical-basis notes (haven-app PR #6,
// docs/clinical-basis.md §1a).

/** One-octave notch width, RBJ Q. */
export const TINNITUS_PRESET_Q = 1.4;

/** Gentler default depth for a wide band: a 20 dB, one-octave cut is a lot of
 * the world to remove; start softer and let the user deepen it. */
export const TINNITUS_PRESET_ATTEN_DB = 12;

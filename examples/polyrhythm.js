/**
 * Polyrhythm - Multiple patterns layered
 *
 * Demonstrates stack() for layering patterns
 * Creates polyrhythmic texture with drums and bass
 */

stack(
  sound("bd*2 sd"),
  sound("hh*8").gain(0.5),
  note("c2 [e2 g2] c2 [a1 c2]").s("sawtooth").lpf(800)
);

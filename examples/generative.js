/**
 * Generative - Algorithmic pattern generation
 *
 * Demonstrates randomness and generative techniques
 * Creates evolving, non-repeating patterns
 */

stack(
  // Random drum pattern
  sound("bd sd hh cp")
    .sometimes(x => x.fast(2))
    .rarely(x => x.rev()),

  // Generative melody
  note("c3 d3 e3 f3 g3 a3 b3 c4")
    .struct("x(3,8)")
    .s("piano")
    .gain(0.7)
    .slow(2)
);

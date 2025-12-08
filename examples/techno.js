/**
 * Techno - Electronic dance music pattern
 *
 * Demonstrates rhythmic patterns, filters, and effects
 * Classic 4/4 techno beat with acid bassline
 */

stack(
  // Kick drum on quarters
  sound("bd*4").gain(1.2),

  // Hi-hats on eighths
  sound("~ hh*2").gain(0.6),

  // Clap on 2 and 4
  sound("~ cp ~ cp"),

  // Acid bassline
  note("<c2 e2 g2 a2>")
    .s("sawtooth")
    .lpf(500)
    .lpr(0.3)
    .gain(0.8)
).fast(1.5);

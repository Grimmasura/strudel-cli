# Strudel CLI Examples

Example patterns demonstrating Strudel live coding techniques.

## Usage

Play any example pattern:

```bash
strudel play examples/basic-drums.js
strudel play examples/melody.js --mode native
strudel play examples/techno.js --mode web
```

Or load in the REPL:

```bash
strudel repl
> .play examples/basic-drums.js
```

## Examples

### basic-drums.js
Simple drum pattern using the `sound()` function.
- **Concepts**: Basic sample playback, `.fast()` modifier
- **Difficulty**: Beginner
- **Duration**: Loops indefinitely

### melody.js
Melodic pattern with piano notes.
- **Concepts**: `note()` function, scales, `.s()` for sound selection
- **Difficulty**: Beginner
- **Duration**: Loops indefinitely

### polyrhythm.js
Multiple patterns layered together.
- **Concepts**: `stack()`, polyrhythms, `.gain()` for volume
- **Difficulty**: Intermediate
- **Duration**: Loops indefinitely

### techno.js
Electronic dance music pattern with bassline.
- **Concepts**: 4/4 rhythm, filters (`.lpf()`), `.lpr()` resonance
- **Difficulty**: Intermediate
- **Duration**: Loops indefinitely

### generative.js
Algorithmic pattern with randomness.
- **Concepts**: `.sometimes()`, `.rarely()`, `.struct()`, generative techniques
- **Difficulty**: Advanced
- **Duration**: Evolving, non-repeating

## Pattern Syntax

Strudel uses TidalCycles-inspired mini-notation:

- `"bd sd hh"` - Sequence of samples
- `"bd*4"` - Repeat 4 times
- `"[bd sd]"` - Group elements
- `"bd ~ sd"` - `~` is a rest
- `"<bd sd>"` - Alternate between elements
- `"bd(3,8)"` - Euclidean rhythm (3 hits in 8 steps)

## Functions

- `sound(pattern)` - Play audio samples
- `note(pattern)` - Play musical notes
- `stack(...patterns)` - Layer multiple patterns
- `.fast(n)` - Speed up by factor n
- `.slow(n)` - Slow down by factor n
- `.gain(n)` - Set volume (0-1)
- `.lpf(freq)` - Low-pass filter
- `.s(sound)` - Select synth/sample set

## Learn More

- [Strudel Documentation](https://strudel.cc/learn/)
- [TidalCycles Tutorial](https://tidalcycles.org/docs/)
- [Mini-notation Reference](https://tidalcycles.org/docs/reference/mini_notation)

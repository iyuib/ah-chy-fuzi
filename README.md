# AhChyFuzi
In short, AhChyFuzi is a fan-made webapp used to make microtonal music in LΛMPLIGHT's microtonal music system. You can learn about it by watching their videos [here](https://www.youtube.com/@L4MPLIGHT).

## How to Use
This webapp turns text into microtonal music. The first step is to define a track.

Track syntax: `$(waveform|fundamental|volume)`
Usage example: `$(triangle|440|0.2)` will set the track's waveform as `triangle`, its fundamental as 440Hz, and set its volume at 0.2 or 20%.

The next step is to define a chord. The chord plays for 1 beat at 60 bpm. To define the notes played, use any of the following characters `+-23456bcdef` to note the relation between the note and the fundamental, then put a `>`. After that, enclose the chord with brackets `[]` to finish making a chord. You can optionaly put a `<` after a note's `>` to extend the individual note's length by 1 beat.

How to use `+-23456bcdef`

| Character | Dimension | Ratio |
| --- | --- | --- |
| + | 1D (octave) up | 2/1 |
| - | 1D (octave) down | 1/2 |
| 2 | 2D  up | 3/2 |
| b | 2D  down | 2/3 |
| 3 | 3D  up | 5/4 |
| c | 3D  down | 4/5 |
| 4 | 4D  up | 7/4 |
| d | 5D  down | 4/7 |
| 5 | 5D  up | 11/4 |
| e | 5D  down | 4/11 |
| 6 | 6D  up | 13/4 |
| f | 6D  down | 4/13 |

Note that 5D and 6D are intervals larger than an octave.
Usage example: `[> 2> b5>]`

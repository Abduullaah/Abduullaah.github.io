# The Round

A team trivia game for a laptop mirrored to a TV. No phones, no accounts, no server.
Open `trivia/index.html` and play.

## The constraint it's built around

One screen, shared by the room. So nothing is ever on the laptop that isn't on the TV,
and in **Party Mode** there is no control that reaches an answer early:

- every question opens behind a 3-2-1 countdown, so the person on the keyboard reads it
  at the same instant as everyone else
- the question closes on a timer, not a click — space bar only pauses
- multiple-choice options are reshuffled per game, so position is never a tell
- scoring happens *after* the reveal, so nothing leaks forward

**Host Mode** drops the timers and hands one person the pace: read it out, let them argue,
reveal when ready, award points by judgement. The host isn't on a team.

## Rounds

| Round | Mechanic | Worth |
|---|---|---|
| Snap Judgement | Four options, 20 seconds, fingers up on LOCK IN | 1 |
| Odd One Out | Three belong, one doesn't | 2 |
| Emoji Decode | Read the emoji, write the title | 2 |
| Closest Wins | Guess a number, closest team takes it | 3 (5 exact) |
| Spot the Lie | Two true, one false | 2 |
| Really?! | True or false, fast | 1 |
| The Connection | Four clues one at a time — stop early, score more | 4 · 3 · 2 · 1 |
| The Final Wager | Bet any part of your score on one question | your call |

Quick (4 rounds, ~15 min), Standard (6, ~30), The Works (8, ~45).

## Keys

`space` does the right thing at every point. `1`–`6` toggle a team when scoring,
`A` everyone, `N` nobody, `Y`/`N` judge a buzz, `M` mute, `esc` back to the menu.

## Files

- `questions.js` — 264 questions. Every one carries a `fact`, the line the screen shows
  on reveal. A question you get wrong should still be worth hearing.
- `app.js` — state machine and screens.
- `style.css` — sized in `vmin` throughout, so the same layout reads on a laptop panel
  and across a living room.

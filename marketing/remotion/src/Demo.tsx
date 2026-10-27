import React from "react";
import { AbsoluteFill, Html5Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Aestra, Intro, Outro } from "./scenes/brand";
import { Battleground, Build, Deploy, Edit, Prompt, Token } from "./scenes/product";
import { Sfx } from "./ui";

/** Scene order and lengths in frames (30 fps). Each cut is a 15-frame crossfade. */
const SCENES: [React.FC, number][] = [
  [Intro, 120],
  [Aestra, 150],
  [Prompt, 215],
  [Build, 265],
  [Edit, 150],
  [Deploy, 165],
  [Token, 225],
  [Battleground, 150],
  [Outro, 150],
];
const FADE = 15;

export const DURATION = SCENES.reduce((sum, [, d]) => sum + d, 0) - FADE * (SCENES.length - 1);

/** First frame of each scene in the finished video (scenes overlap by FADE). */
const STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((sum, [, d]) => sum + d, 0) - FADE * i);

export function Demo() {
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {/* Music bed (make-audio.mjs) under everything, and a whoosh into every cut. */}
      <Html5Audio src={staticFile("sfx/music.wav")} volume={0.42} />
      {STARTS.slice(1).map((s) => (
        <Sfx key={s} at={s - 4} name="whoosh" volume={0.4} />
      ))}
      <TransitionSeries>
        {SCENES.flatMap(([Scene, frames], i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
            <Scene />
          </TransitionSeries.Sequence>,
          ...(i < SCENES.length - 1 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />] : []),
        ])}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

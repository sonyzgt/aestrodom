import React from "react";
import { Composition } from "remotion";
import { DURATION, Demo } from "./Demo";
import { PROMO_DURATION, Promo } from "./Promo";
import { TOPUP_DURATION, Topup } from "./Topup";
import { SKILLS_DURATION, SkillsGuide } from "./Skills";
import { BATTLE_DURATION, BattleVote } from "./Battle";
import { PASS_DURATION, PassTeaser } from "./Pass";

export function RemotionRoot() {
  return (
    <>
      <Composition id="AestrodomDemo" component={Demo} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomTopup" component={Topup} durationInFrames={TOPUP_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomSkills" component={SkillsGuide} durationInFrames={SKILLS_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomBattle" component={BattleVote} durationInFrames={BATTLE_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomPass" component={PassTeaser} durationInFrames={PASS_DURATION} fps={30} width={1080} height={1080} />
      <Composition id="AestrodomPromo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1080} height={1080} />
    </>
  );
}

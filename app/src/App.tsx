import {Player} from '@remotion/player';
import {Reel} from '@studio/Reel';
import smoke from '../../studio/fixtures/smoke-props.json';
import type {RenderProps} from '@studio/types';

const props = smoke as unknown as RenderProps;
export const App = () => (
  <Player component={Reel} inputProps={props} durationInFrames={Math.max(1, Math.ceil(props.totalSeconds * props.fps))}
    fps={props.fps} compositionWidth={props.width} compositionHeight={props.height}
    style={{width: 360, aspectRatio: '9 / 16'}} controls acknowledgeRemotionLicense />
);

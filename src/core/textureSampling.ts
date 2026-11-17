import Phaser from 'phaser';

/** Phaser 4.2 interpolates texture IDs as floats; exact equality can discard parts of a quad. */
export function stabilizeTextureSampling(game: Phaser.Game): void {
  if (!(game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const batch = game.renderer.renderNodes.getNode('BatchHandlerQuad') as Phaser.Renderer.WebGL.RenderNodes.BatchHandlerQuad;
  const programs = batch.programManager;
  const sampler = programs.getAdditionsByTag('TEXTURE')[0];
  if (!sampler || programs.getAddition('RoundSamplerTextureId')) return;
  const index = programs.getAdditionIndex(sampler.name);
  // Scope rounding to the sampler function, leaving UVs and lighting rotation data intact.
  // Separate additions keep this in place when Phaser replaces its sampler after a mode change.
  programs.addAddition({
    name: 'RoundSamplerTextureId',
    additions: { fragmentHeader: '#define outTexDatum floor(outTexDatum + 0.5)' },
  }, index);
  programs.addAddition({
    name: 'RestoreTextureDatum',
    additions: { fragmentHeader: '#undef outTexDatum' },
  }, index + 2);
}

// main.js — bootstraps the app.
(function () {
  'use strict';

  function centerViewOnOrigin() {
    const rect = document.getElementById('workspace-container').getBoundingClientRect();
    const v = MC.State.data.view;
    v.zoom = 1;
    v.panX = rect.width / 2 - 300;
    v.panY = rect.height / 2 - 200;
  }

  function init() {
    MC.Render.init();
    MC.Interactions.init();
    MC.UI.init();
    MC.State.subscribe(() => MC.Render.renderAll());
    MC.State.subscribeSelection(() => MC.Render.renderAll());

    IO_initAutosaveThenRender();

    window.addEventListener('resize', () => { MC.Interactions.scheduleRender(); });
  }

  function IO_initAutosaveThenRender() {
    const hadContentBefore = MC.State.data.boards.length || MC.State.data.components.length;
    MC.IO.initAutosave();
    const hasContentAfter = MC.State.data.boards.length || MC.State.data.components.length;
    if (!hasContentAfter && !hadContentBefore) centerViewOnOrigin();
    MC.Render.renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

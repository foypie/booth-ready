Booth Ready — Safe Founder Rail Patch Pack

Purpose:
- Moves/clones the existing lower-left founder photo into the right rail.
- Places it between BUILT DIFFERENT and STAY CONNECTED.
- Hides the old isolated lower-left photo.
- Does NOT replace index.html, styles.css, or script.js.
- Does NOT touch checkout, beat cards, waveforms, pricing, or catalog logic.

Files:
- founder-rail-patch.css
- founder-rail-patch.js

Install:

1. Put both files in your main Booth Ready folder:
   /booth-ready-DESIGN-LAB/founder-rail-patch.css
   /booth-ready-DESIGN-LAB/founder-rail-patch.js

2. In index.html, add this line BELOW your existing styles.css link:

   <link rel="stylesheet" href="founder-rail-patch.css">

3. In index.html, add this line BELOW your existing script.js script tag:

   <script src="founder-rail-patch.js"></script>

4. Save, restart server if needed, then hard refresh Chrome.

Rollback:
- Remove those two lines from index.html.
- Delete founder-rail-patch.css and founder-rail-patch.js.

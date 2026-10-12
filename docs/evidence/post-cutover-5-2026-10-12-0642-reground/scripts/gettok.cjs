// Get a rig token for the rendered pass. Usage: SCRATCH_PASS=... PORT=4744 node gettok.cjs
const fs = require('fs');
const PORT = process.env.PORT || '4744';
const OUT = process.env.OUT || '/home/agent-product-designer/rig-final3-out';
const pass = (process.env.SCRATCH_PASS || '').trim();
if (!pass) { console.error('SCRATCH_PASS empty'); process.exit(1); }
(async () => {
  try {
    const r = await fetch('http://localhost:' + PORT + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'scratch-admin', password: pass })
    });
    const j = await r.json();
    if (!j.token) { console.error('login failed HTTP ' + r.status + ' ' + JSON.stringify(j)); process.exit(1); }
    fs.writeFileSync(OUT + '/token.json', JSON.stringify(j));
    console.log('token length ' + j.token.length + '  user ' + JSON.stringify(j.user || { username: 'scratch-admin' }));
  } catch (e) { console.error('ERROR ' + e.message); process.exit(1); }
})();

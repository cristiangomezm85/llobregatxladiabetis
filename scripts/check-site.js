const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const required = [
  'index.html', 'el-repte.html', 'persones.html', 'pobles.html', 'patrocina.html', 'patrocinadors.html',
  'herois.json', 'pobles.json', 'patrocinadors.json', 'admin/index.html', 'assets/lxd-admin.js',
  'assets/lxd-lang-sync.js', 'assets/lxd-universal-form.js', 'netlify/functions/admin-content.js', 'netlify.toml'
];
let ok = true;
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error('Falta:', file);
    ok = false;
  }
}
for (const file of ['herois.json', 'pobles.json', 'patrocinadors.json', 'admin/solicitudes-herois.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (err) { console.error('JSON inválido:', file, err.message); ok = false; }
}
for (const file of ['assets/lxd-admin.js', 'assets/lxd-lang-sync.js', 'assets/lxd-universal-form.js', 'netlify/functions/admin-content.js']) {
  try { new Function(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (err) { console.error('JS inválido:', file, err.message); ok = false; }
}
console.log(ok ? 'OK · estructura básica correcta' : 'ERROR · revisa los mensajes anteriores');
process.exit(ok ? 0 : 1);

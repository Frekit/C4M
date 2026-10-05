import { wcagContrast, parse, converter, formatHex } from 'culori'; import fs from 'fs';
export const T = {
 light: {
  'bg':'oklch(0.985 0.004 80)', 'surface':'oklch(0.997 0.002 85)', 'surface-2':'oklch(0.968 0.006 80)', 'surface-3':'oklch(0.945 0.008 78)',
  'fg':'oklch(0.22 0.012 60)', 'fg-muted':'oklch(0.47 0.02 60)', 'fg-subtle':'oklch(0.53 0.016 60)',
  'border':'oklch(0.91 0.009 75)', 'border-strong':'oklch(0.64 0.012 70)',
  'primary':'oklch(0.27 0.02 50)', 'primary-hover':'oklch(0.34 0.022 50)', 'primary-fg':'oklch(0.985 0.004 80)',
  'brand':'oklch(0.54 0.15 45)', 'brand-ui':'oklch(0.64 0.155 45)', 'brand-muted':'oklch(0.96 0.025 55)', 'brand-fg':'oklch(0.99 0.004 80)',
  'success':'oklch(0.50 0.12 150)', 'success-muted':'oklch(0.955 0.035 150)', 'success-dot':'oklch(0.62 0.15 150)',
  'warning':'oklch(0.52 0.115 62)', 'warning-muted':'oklch(0.962 0.045 85)', 'warning-dot':'oklch(0.66 0.14 68)',
  'info':'oklch(0.50 0.10 245)', 'info-muted':'oklch(0.955 0.025 245)', 'info-dot':'oklch(0.62 0.13 245)',
  'danger':'oklch(0.50 0.19 27)', 'danger-muted':'oklch(0.955 0.03 25)', 'danger-dot':'oklch(0.60 0.21 27)',
  'focus':'oklch(0.64 0.155 45)', 'ai':'oklch(0.52 0.17 285)', 'ai-muted':'oklch(0.96 0.022 285)',
 },
 dark: {
  'bg':'oklch(0.165 0.008 60)', 'surface':'oklch(0.2 0.009 60)', 'surface-2':'oklch(0.225 0.01 60)', 'surface-3':'oklch(0.26 0.011 60)',
  'fg':'oklch(0.95 0.006 80)', 'fg-muted':'oklch(0.74 0.014 70)', 'fg-subtle':'oklch(0.68 0.014 70)',
  'border':'oklch(0.29 0.01 60)', 'border-strong':'oklch(0.52 0.012 65)',
  'primary':'oklch(0.93 0.012 80)', 'primary-hover':'oklch(0.86 0.014 80)', 'primary-fg':'oklch(0.2 0.012 60)',
  'brand':'oklch(0.76 0.13 52)', 'brand-ui':'oklch(0.72 0.14 50)', 'brand-muted':'oklch(0.27 0.045 50)', 'brand-fg':'oklch(0.18 0.01 60)',
  'success':'oklch(0.80 0.12 150)', 'success-muted':'oklch(0.26 0.04 150)', 'success-dot':'oklch(0.72 0.15 150)',
  'warning':'oklch(0.84 0.12 80)', 'warning-muted':'oklch(0.27 0.045 75)', 'warning-dot':'oklch(0.8 0.15 75)',
  'info':'oklch(0.80 0.09 245)', 'info-muted':'oklch(0.26 0.04 245)', 'info-dot':'oklch(0.7 0.12 245)',
  'danger':'oklch(0.78 0.13 25)', 'danger-muted':'oklch(0.27 0.05 25)', 'danger-dot':'oklch(0.68 0.19 27)',
  'focus':'oklch(0.72 0.14 50)', 'ai':'oklch(0.78 0.12 285)', 'ai-muted':'oklch(0.27 0.045 285)',
 }
};
// [fg, bg, min, uso]
export const PAIRS = [
 ['fg','bg',4.5,'Texto principal'],['fg','surface',4.5,'Texto en tarjeta'],['fg','surface-2',4.5,'Texto en sidebar/cabecera tabla'],['fg','surface-3',4.5,'Texto en fila hover/seleccionada'],
 ['fg-muted','bg',4.5,'Texto secundario'],['fg-muted','surface',4.5,'Secundario en tarjeta'],['fg-muted','surface-2',4.5,'Secundario en sidebar'],['fg-muted','surface-3',4.5,'Secundario en hover'],
 ['fg-subtle','surface',4.5,'Placeholder / metadato'],['fg-subtle','surface-2',4.5,'Placeholder en tabla'],
 ['border-strong','surface',3,'Borde de input (1.4.11)'],['border-strong','bg',3,'Borde de input sobre fondo'],
 ['primary-fg','primary',4.5,'Botón primario'],['primary-fg','primary-hover',4.5,'Botón primario hover'],['primary','bg',3,'Botón primario vs fondo (no-texto)'],
 ['brand','surface',4.5,'Enlace / texto marca'],['brand','bg',4.5,'Enlace sobre fondo'],['brand-ui','surface',3,'Indicador marca (no-texto)'],['brand','brand-muted',4.5,'Texto marca sobre tinte'],
 ['focus','bg',3,'Anillo de foco vs fondo'],['focus','surface',3,'Anillo de foco vs tarjeta'],
 ['success','success-muted',4.5,'Pill éxito'],['warning','warning-muted',4.5,'Pill aviso'],['info','info-muted',4.5,'Pill info'],['danger','danger-muted',4.5,'Pill peligro'],
 ['success','surface',4.5,'Texto éxito en tarjeta'],['warning','surface',4.5,'Texto aviso en tarjeta'],['info','surface',4.5,'Texto info en tarjeta'],['danger','surface',4.5,'Texto error en tarjeta'],['danger','bg',4.5,'Texto error en fondo'],
 ['success-dot','surface',3,'Punto éxito (no-texto)'],['warning-dot','surface',3,'Punto aviso (no-texto)'],['info-dot','surface',3,'Punto info'],['danger-dot','surface',3,'Punto peligro'],
 ['ai','ai-muted',4.5,'Texto IA sobre tinte'],['brand-fg','brand',4.5,'Texto sobre botón marca'],['bg','ai',4.5,'Texto claro sobre IA sólido (badge)'],['ai','surface',4.5,'Texto IA en tarjeta'],
];
const toHex=c=>formatHex(converter('rgb')(parse(c)));
if (process.argv[2]==='check'){
 let fails=0; const rows=[];
 for (const mode of ['light','dark']) for (const [a,b,min,u] of PAIRS){ const r=wcagContrast(T[mode][a],T[mode][b]); const ok=r>=min; if(!ok)fails++; rows.push({mode,a,b,r:r.toFixed(2),min,ok,u}); if(!ok||process.argv[3]) console.log(mode.padEnd(6),(a+' / '+b).padEnd(30),r.toFixed(2),ok?'OK':'FAIL <'+min,u); }
 console.log('fails',fails,'of',rows.length); fs.writeFileSync('/workspace/c4m-audit/tokens-contrast.json',JSON.stringify(rows,null,1));
 // CSS
 const css=m=>Object.entries(T[m]).map(([k,v])=>`  --${k}: ${v};`).join('\n');
 fs.writeFileSync('/workspace/c4m-audit/mockups/tokens.css',`:root{\n${css('light')}\n}\n.dark{\n${css('dark')}\n}\n`);
 fs.writeFileSync('/workspace/c4m-audit/tokens-hex.json',JSON.stringify(Object.fromEntries(['light','dark'].map(m=>[m,Object.fromEntries(Object.entries(T[m]).map(([k,v])=>[k,toHex(v)]))])),null,1));
}

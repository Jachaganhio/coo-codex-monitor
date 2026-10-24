import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
// Creates reviewable source files; does not change an installed application or Codex files.
const checkout=resolve(process.argv[2]??'../Coopanion');
const source=readFileSync(join(checkout,'core','companion.ts'),'utf8');
const marker='const bundled = [CONSOLE, DESKTOP_PET, NOTICE] as WorldDefinition<WorldSection>[];';
if(!source.includes(marker))throw new Error('Upstream assembly changed; inspect before adapting patch');
const out=resolve('.local','coopanion-patch');mkdirSync(out,{recursive:true});
const world=relative(join(checkout,'core'),resolve('packages/coopanion-world/src/index.ts')).replaceAll('\\','/');
const addition=`const MONITOR = createMonitorDefinition({
    ready: () => !guiding && (pet as DesktopPetWorld | null)?.petState().connected === true && core?.loop.getStatus().phase.state === 'idle',
    show: async (text) => {
      const target = pet as DesktopPetWorld | null;
      if (!target?.petState().connected) return false;
      const result = await target.dialog({ text, closable: true }).answer;
      return !('unavailable' in result);
    },
  });
  const bundled = [CONSOLE, DESKTOP_PET, NOTICE, MONITOR] as WorldDefinition<WorldSection>[];`;
const assetMarker='registerProviderModules([COO, CHATGPT_PROVIDER, ...extensions.providers]);';
if(!source.includes(assetMarker))throw new Error('Upstream asset assembly changed');
const assetLine=`extensions.webUiAssets.push(...appWebUiAsset(MONITOR.id, fileURLToPath(new URL('${world.replace('index.ts','')}', import.meta.url)), '0.1.0'));`;
writeFileSync(join(out,'companion.ts'),`import { createMonitorDefinition } from '${world}';\n`+source.replace(marker,addition).replace(assetMarker,assetMarker+'\n  '+assetLine));
copyFileSync(join(checkout,'core','companion.ts'),join(out,'companion.original.ts'));
console.log(`Review ${out}. Source-only integration; built app needs rebuild. See docs/WINDOWS.md.`);

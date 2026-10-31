// Camada de persistência. Hoje: arquivos JSON em data/runtime (protótipo).
// Os módulos só conhecem esta interface (all/get/find/insert/update/remove),
// então trocar por PostgreSQL/MySQL/Firestore significa reimplementar este arquivo.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const cache = new Map();

function fileOf(name) {
  return path.join(config.paths.runtime, `${name}.json`);
}

function load(name, fallback) {
  if (cache.has(name)) return cache.get(name);
  const file = fileOf(name);
  let data = fallback;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    const seed = path.join(config.paths.seed, `${name}.json`);
    if (fs.existsSync(seed)) data = JSON.parse(fs.readFileSync(seed, 'utf8'));
    persist(name, data);
  }
  cache.set(name, data);
  return data;
}

function persist(name, data) {
  fs.mkdirSync(config.paths.runtime, { recursive: true });
  const file = fileOf(name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // escrita atômica
}

export function collection(name) {
  const rows = () => load(name, []);
  const save = () => persist(name, rows());
  return {
    all: () => rows(),
    get: (id) => rows().find((r) => r.id === id) || null,
    find: (pred) => rows().find(pred) || null,
    filter: (pred) => rows().filter(pred),
    insert(row) {
      rows().push(row);
      save();
      return row;
    },
    update(id, patch) {
      const row = rows().find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      save();
      return row;
    },
    remove(id) {
      const list = rows();
      const i = list.findIndex((r) => r.id === id);
      if (i === -1) return false;
      list.splice(i, 1);
      save();
      return true;
    },
  };
}

export function documentStore(name) {
  return {
    read: () => load(name, {}),
    write(patch) {
      const doc = load(name, {});
      Object.assign(doc, patch);
      persist(name, doc);
      return doc;
    },
  };
}

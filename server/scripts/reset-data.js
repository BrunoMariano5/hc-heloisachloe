// Apaga os dados de execução (produtos editados, clientes, sessões de admin)
// e volta ao catálogo inicial de data/seed no próximo início.
import fs from 'node:fs';
import { config } from '../config.js';

fs.rmSync(config.paths.runtime, { recursive: true, force: true });
console.log('Dados de execução removidos. O próximo início recria tudo a partir de data/seed.');

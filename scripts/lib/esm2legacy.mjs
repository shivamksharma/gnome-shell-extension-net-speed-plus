import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, posix, relative } from 'node:path';

function resolveModule(module, id) {
    if (module.startsWith('gi://'))
        return `imports.gi.${module.slice('gi://'.length)}`;

    const shellPrefix = 'resource:///org/gnome/shell/';
    if (module.startsWith(shellPrefix)) {
        const subpath = module.slice(shellPrefix.length).replace(/\.js$/, '');
        const [namespace, name] = subpath.split('/');
        if (name === undefined)
            throw new Error(`Cannot convert shell module "${module}" in ${id}`);
        return `imports.${namespace}.${name}`;
    }

    if (module.startsWith('./') || module.startsWith('../')) {
        const resolved = posix.normalize(posix.join(posix.dirname(id), module)).replace(/\.js$/, '');
        if (resolved.startsWith('..'))
            throw new Error(`Import "${module}" escapes the shared source root in ${id}`);
        return `imports.${resolved.split('/').join('.')}`;
    }

    throw new Error(`Unsupported import source "${module}" in ${id}`);
}

function convertImport(binding, module, id) {
    const target = resolveModule(module, id);
    const trimmed = binding.trim();

    if (trimmed.startsWith('* as '))
        return `const ${trimmed.slice('* as '.length)} = ${target};`;

    if (trimmed.startsWith('{'))
        return `const ${trimmed} = ${target};`;

    return `const ${trimmed} = ${target};`;
}

function convertExport(line) {
    if (/^export\s+default\b/.test(line))
        throw new Error('export default is not supported by the legacy converter');

    if (/^export\s*\{/.test(line))
        throw new Error('export lists are not supported by the legacy converter');

    const classMatch = line.match(/^export\s+class\s+(\w+)(.*)$/);
    if (classMatch)
        return `var ${classMatch[1]} = class ${classMatch[1]}${classMatch[2]}`;

    return line
        .replace(/^export\s+async\s+function\s+/, 'async function ')
        .replace(/^export\s+function\s+/, 'function ')
        .replace(/^export\s+(const|let|var)\s+/, 'var ');
}

export function convert(source, id) {
    const lines = source.split('\n');
    const output = [];

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];

        if (/^\s*import\s/.test(line)) {
            let statement = line;
            while (!statement.trimEnd().endsWith(';') && index + 1 < lines.length)
                statement += ` ${lines[++index].trim()}`;

            const match = statement.trim().match(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?$/);
            if (!match)
                throw new Error(`Cannot parse import "${statement.trim()}" in ${id}`);

            output.push(convertImport(match[1], match[2], id));
            continue;
        }

        if (/^export\s/.test(line)) {
            output.push(convertExport(line));
            continue;
        }

        output.push(line);
    }

    return output.join('\n');
}

function convertDirectory(sourceDir, outputDir, idRoot) {
    for (const entry of readdirSync(sourceDir)) {
        const sourcePath = join(sourceDir, entry);
        const outputPath = join(outputDir, entry);

        if (statSync(sourcePath).isDirectory()) {
            mkdirSync(outputPath, { recursive: true });
            convertDirectory(sourcePath, outputPath, idRoot);
            continue;
        }

        if (!entry.endsWith('.js'))
            continue;

        const id = relative(idRoot, sourcePath).split('\\').join('/');
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, convert(readFileSync(sourcePath, 'utf8'), id));
    }
}

const [sourceRoot, outputRoot, ...subdirectories] = process.argv.slice(2);
if (sourceRoot && outputRoot) {
    for (const subdirectory of subdirectories) {
        const sourceDir = join(sourceRoot, subdirectory);
        const outputDir = join(outputRoot, subdirectory);
        mkdirSync(outputDir, { recursive: true });
        convertDirectory(sourceDir, outputDir, sourceRoot);
    }
}

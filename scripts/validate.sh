#!/usr/bin/env bash
#
# Static validation and packaging checks for Net Speed Plus.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

EXPECTED_UUID="netspeed@shivamksharma.github.io"
EXPECTED_SCHEMA="org.gnome.shell.extensions.netspeed_plus"

cd "$ROOT_DIR"

failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
pass() { echo "  ok: $*"; }

echo "== Tools =="
for tool in node zip unzip; do
    if command -v "$tool" >/dev/null 2>&1; then
        pass "$tool"
    else
        fail "$tool is required"
    fi
done
command -v glib-compile-schemas >/dev/null 2>&1 && pass "glib-compile-schemas" || fail "glib-compile-schemas is required"
command -v gjs >/dev/null 2>&1 && pass "gjs" || echo "  warn: gjs not found (runtime tests skipped)"

echo "== Metadata =="
for metadata in metadata.json metadata/metadata.legacy.json; do
    if node - "$metadata" "$EXPECTED_UUID" "$EXPECTED_SCHEMA" <<'NODE'
const fs = require('fs');
const [file, expectedUuid, expectedSchema] = process.argv.slice(2);
const problems = [];
let data;
try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
    console.error(`FAIL: ${file} is not valid JSON: ${e.message}`);
    process.exit(1);
}
if (data.uuid !== expectedUuid) problems.push(`uuid is "${data.uuid}"`);
if (data['settings-schema'] !== expectedSchema) problems.push(`settings-schema is "${data['settings-schema']}"`);
if (!Array.isArray(data['shell-version']) || data['shell-version'].length === 0) problems.push('shell-version is empty');
if ('gettext-domain' in data) problems.push('gettext-domain is set but translations are not implemented');
if (typeof data.version !== 'number') problems.push('version must be a number');
if (!data.url) problems.push('url is missing');
if (problems.length) {
    console.error(`FAIL: ${file}: ${problems.join('; ')}`);
    process.exit(1);
}
NODE
    then
        pass "$metadata"
    else
        fail "$metadata is invalid"
    fi
done

echo "== GSettings schema =="
if glib-compile-schemas --strict --dry-run schemas 2>/dev/null; then
    pass "schema compiles strictly"
else
    fail "schema does not compile"
fi
if grep -q 'gettext-domain' schemas/*.gschema.xml; then
    fail "schema declares gettext-domain but translations are not implemented"
else
    pass "schema has no gettext-domain"
fi

echo "== JavaScript syntax =="
while IFS= read -r file; do
    if node --input-type=module --check < "$file" 2>/dev/null; then
        pass "esm $file"
    else
        fail "esm $file does not parse"
    fi
done < <(find src/core src/shell src/modern -name '*.js' | sort)

while IFS= read -r file; do
    if node --check "$file" 2>/dev/null; then
        pass "legacy $file"
    else
        fail "legacy $file does not parse"
    fi
done < <(find src/legacy -name '*.js' | sort)

echo "== Forbidden patterns =="
check_absent() {
    local pattern="$1"
    local label="$2"
    shift 2
    if grep -RInE "$pattern" "$@" >/dev/null 2>&1; then
        fail "$label"
    else
        pass "$label"
    fi
}

check_absent 'spawn_command_line_sync|spawn_sync|spawnCommandLineSync' "no synchronous subprocesses in src/" src
check_absent 'imports\.byteArray|Imports\.byteArray' "no deprecated imports.byteArray" src
check_absent '\bconsole\.log\b|\bprint\s*\(' "no debug printing in src/" src
check_absent '\bimports\.' "shared core/shell stays free of imports.*" src/core src/shell
check_absent '\bimports\.' "modern generation stays free of imports.*" src/modern
check_absent 'buildPrefsWidget' "modern preferences do not use buildPrefsWidget" src/modern
check_absent 'aggregateMenu|Main\.panel\._|\._statusArea' "no private Shell APIs" src
check_absent 'TODO|FIXME|XXX' "no leftover TODO/FIXME markers" src

echo "== Transpiler output =="
node scripts/lib/esm2legacy.mjs src "$TMP_DIR/legacy" core shell
if grep -RInE '^\s*(import|export)\s' "$TMP_DIR/legacy" >/dev/null 2>&1; then
    fail "transpiled legacy output still contains ESM syntax"
else
    pass "transpiled legacy output has no ESM syntax"
fi

echo "== Packaging =="
"$SCRIPT_DIR/build-all.sh" >/dev/null

echo "== Import resolution =="
if node - <<'NODE'
const fs = require('fs');
const path = require('path');
let bad = 0;

function walk(dir, visit) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory())
            walk(full, visit);
        else if (full.endsWith('.js'))
            visit(full);
    }
}

if (fs.existsSync('build/modern')) {
    walk('build/modern', file => {
        const source = fs.readFileSync(file, 'utf8');
        const re = /from\s+['"](\.[^'"]+)['"]/g;
        let match;
        while ((match = re.exec(source))) {
            const target = path.resolve(path.dirname(file), match[1]);
            if (!fs.existsSync(target)) {
                console.error(`FAIL: modern import "${match[1]}" in ${file} does not resolve`);
                bad++;
            }
        }
    });
}

if (fs.existsSync('build/legacy')) {
    walk('build/legacy', file => {
        const source = fs.readFileSync(file, 'utf8');
        const re = /imports\.(core|shell)\.([A-Za-z0-9_]+)/g;
        let match;
        while ((match = re.exec(source))) {
            const target = path.join('build/legacy', match[1], `${match[2]}.js`);
            if (!fs.existsSync(target)) {
                console.error(`FAIL: legacy import "imports.${match[1]}.${match[2]}" in ${file} does not resolve`);
                bad++;
            }
        }
    });
}

process.exit(bad ? 1 : 0);
NODE
then
    pass "all imports resolve"
else
    fail "unresolved imports"
fi

for zip in "$ROOT_DIR"/dist/net-speed-plus-*.shell-extension.zip; do
    listing="$(unzip -Z1 "$zip")"
    name="$(basename "$zip")"

    echo "$listing" | grep -qx 'extension.js' && pass "$name: extension.js" || fail "$name: missing extension.js"
    echo "$listing" | grep -qx 'prefs.js' && pass "$name: prefs.js" || fail "$name: missing prefs.js"
    echo "$listing" | grep -qx 'metadata.json' && pass "$name: metadata.json" || fail "$name: missing metadata.json"

    if echo "$listing" | grep -q 'gschemas.compiled'; then
        fail "$name: ships gschemas.compiled (not needed)"
    else
        pass "$name: no compiled schema"
    fi

    if echo "$listing" | grep -qE '(^|/)(\.git|node_modules|tests|scripts)/'; then
        fail "$name: contains development files"
    else
        pass "$name: no development files"
    fi

    EXPECTED_UUID="$EXPECTED_UUID" unzip -p "$zip" metadata.json > "$TMP_DIR/meta.json"
    if ! EXPECTED_UUID="$EXPECTED_UUID" node - "$TMP_DIR/meta.json" "$name" <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (data.uuid !== process.env.EXPECTED_UUID) {
    console.error(`FAIL: uuid ${data.uuid}`);
    process.exit(1);
}
NODE
    then
        fail "$name: uuid mismatch"
    else
        pass "$name: uuid"
    fi
done

echo
if [ "$failures" -gt 0 ]; then
    echo "Validation failed with $failures problem(s)."
    exit 1
fi
echo "Validation passed."

import Gio from 'gi://Gio';

const decoder = new TextDecoder('utf-8');

function loadContents(file) {
    return new Promise((resolve, reject) => {
        file.load_contents_async(null, (source, result) => {
            try {
                const [success, contents] = source.load_contents_finish(result);
                resolve(success ? decoder.decode(contents) : '');
            } catch (error) {
                reject(error);
            }
        });
    });
}

export function readTextFileAsync(path) {
    return loadContents(Gio.File.new_for_path(path));
}

export async function readProcNetDevAsync() {
    try {
        return await readTextFileAsync('/proc/net/dev');
    } catch (error) {
        return '';
    }
}

export async function readDefaultRouteFilesAsync() {
    const [ipv4, ipv6] = await Promise.all([
        readTextFileAsync('/proc/net/route').catch(() => ''),
        readTextFileAsync('/proc/net/ipv6_route').catch(() => ''),
    ]);

    return { ipv4, ipv6 };
}

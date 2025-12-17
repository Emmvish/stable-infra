export function safelyStringify(data, maxLength = 1000) {
    try {
        const str = JSON.stringify(data);
        if (maxLength < 0) {
            maxLength = 1000;
        }
        return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
    }
    catch {
        return '[Unserializable data]';
    }
}
//# sourceMappingURL=safely-stringify.js.map
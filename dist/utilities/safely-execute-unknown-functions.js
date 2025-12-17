export async function safelyExecuteUnknownFunctions(f, ...args) {
    const result = f(...args);
    if (result instanceof Promise) {
        await result;
    }
    return result;
}
//# sourceMappingURL=safely-execute-unknown-functions.js.map
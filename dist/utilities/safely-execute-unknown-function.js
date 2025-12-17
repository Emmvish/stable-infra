export async function safelyExecuteUnknownFunction(f, ...args) {
    const result = f(...args);
    if (result instanceof Promise) {
        await result;
    }
    return result;
}
//# sourceMappingURL=safely-execute-unknown-function.js.map
export async function delay(wait = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, Math.min(wait, 60000));
    });
}
//# sourceMappingURL=delay.js.map